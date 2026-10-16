const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, 'config.env') });
const axios = require('axios');
const mongoose = require('mongoose');
const { Place } = require('./models/place-model');

const options = {
    method: 'GET',
    url: 'https://openweb.nlb.gov.sg/api/v1/Library/GetBranches',
    params: {
        LibraryTypes: 'PL,RL,NL'
    },
    headers: {
        'X-Api-Key': process.env.NLB_API_KEY,
        'X-App-Code': process.env.NLB_API_CODE
    }
}

// Strip HTML text in Description
function stripHtml(text) {
    return (text || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

function mapPlace(branch) {
    const address = branch.address;
    const schedules = branch.schedules || [];
    const facilityNames = (branch.libraryFacilities || []).map(f => f.facilityName.toLowerCase());

    const facilities = ['wifi', 'toilets', 'quiet'];
    if (facilityNames.some(n => n.includes('caf'))) facilities.push('fnb');
    if (facilityNames.some(n => n.includes('water'))) facilities.push('water');

    const images = branch.libraryImages || {};
    const photos = [images.mainImage, ...(images.supplementaryImages || []).map(i => i.image)].filter(Boolean);

    return {
        branchCode: branch.branchCode,
        name: branch.branchName,
        address: [`${address.block} ${address.streetName}`.trim(), address.unit && `#${address.unit.replace(/^#/, '')}`, address.buildingName, `Singapore ${address.postalCode}`]
            .filter(Boolean).join(', '),
        area: (branch.transportation.mrtStation || address.streetName).split(/[,(]/)[0].trim(),
        lat: Number(branch.coordinates.geoLatitude),
        lon: Number(branch.coordinates.geoLongitude),
        indoor: true,
        capacity: 200, // rough default; adjust per branch in the admin form
        openNow: schedules.length > 0,
        closureStatus: schedules.length > 0 ? 'normal' : 'temporary',
        hours: schedules.length
            ? `${schedules[0].openingTime.slice(0, 5)} - ${schedules[0].closingTime.slice(0, 5)}`
            : 'Closed for renovation',
        facilities,
        tags: ['Individual study', 'Quiet'],
        photos,
        description: stripHtml(branch.notes.introductoryNote) || stripHtml(branch.notes.description)
    };
}


async function importLibraries() {
    try {
        const { data } = await axios.request(options);
        const libraries = data.branches.filter(b => b.isVisibleOnSite && Number(b.coordinates.geoLatitude) !== 0);

        await mongoose.connect(process.env.DB, { serverSelectionTimeoutMS: 5000 });

        const alreadyImported = await Place.countDocuments({ branchCode: { $exists: true } });
        if (alreadyImported > 0 && !process.argv.includes('--force')) {
            console.log(`Libraries already imported (${alreadyImported} found). Nothing changed.`);
            console.log('To re-import from NLB on purpose, run: node import-libraries.js --force');
            return;
        }

        const last = await Place.findOne().sort({ id: -1 });
        let maxId = last ? last.id : 0;
        let created = 0;

        for (const branch of libraries) {
            const place = mapPlace(branch);
            const existing = await Place.findOne({ branchCode: place.branchCode });
            const id = existing ? existing.id : ++maxId;
            if (!existing) created++;

            // $set leaves rating/reviewCount alone for re-runs
            await Place.updateOne({ id }, { $set: { ...place, id } }, { upsert: true });
        }

        console.log(`Imported ${libraries.length} libraries (${created} new, ${libraries.length - created} updated)`);
    } catch (error) {
        console.error('Import failed:', error.response?.status, error.response?.data || error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

importLibraries();