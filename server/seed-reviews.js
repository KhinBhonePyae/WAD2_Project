const mongoose = require('mongoose')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({
  path:path.join(__dirname, 'config.env')
})

// Registers the Review model
require('./models/review-model')

const Review = mongoose.model('Review')

const comments = {
  quiet:[
    'Very peaceful and easy to focus.',
    'Plenty of quiet space available.',
    'Calm environment for studying.',
    'Not many people around when I visited.'
  ],

  moderate:[
    'A few people around but still comfortable.',
    'Moderately busy with some seats available.',
    'Some activity, but still suitable for studying.',
    'Quite busy but I could still find a seat.'
  ],

  packed:[
    'Very busy with limited seats available.',
    'Crowded during this period.',
    'Most seats were occupied.',
    'Quite noisy and difficult to find a seat.'
  ]
}

const levels = ['quiet', 'moderate', 'packed']

function pick(array, index) {
  return array[index % array.length]
}

function makeDate(placeId, reviewIndex) {
  const date = new Date()

  // Spread dummy reviews across the previous 14 days
  const daysAgo = ((placeId + reviewIndex * 2) % 14) + 1
  date.setDate(date.getDate() - daysAgo)

  // Different realistic study hours
  const hours = [9, 11, 14, 17, 20]

  date.setHours(
    hours[reviewIndex % hours.length],
    (placeId * 7) % 60,
    0,
    0
  )

  return date
}

async function seedReviews() {
  const mongoUri =
    process.env.DB ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error(
      'MongoDB connection string was not found in config.env'
    )
  }

  await mongoose.connect(mongoUri)

  console.log('MongoDB connected')

  // Get all study spaces
  const places = await mongoose.connection
    .collection('places')
    .find(
      {},
      {
        projection:{
          id:1,
          name:1
        }
      }
    )
    .sort({ id:1 })
    .toArray()

  console.log(`Found ${places.length} places`)

  // Get all real registered accounts.
  // Both normal users and admins can be used as review authors.
  const users = await mongoose.connection
    .collection('users')
    .find(
      {
        role:{ $in:['user', 'admin'] }
      },
      {
        projection:{
          _id:1,
          name:1,
          email:1,
          role:1
        }
      }
    )
    .sort({ createdAt:1 })
    .toArray()

  if (!users.length) {
    throw new Error(
      'No user accounts were found in the users collection.'
    )
  }

  console.log(`Found ${users.length} registered accounts:`)

  for (const user of users) {
    console.log(`- ${user.name} (${user.role})`)
  }

  /*
   * Remove dummy reviews created by BOTH versions of the seed script.
   *
   * 1. New seeded reviews have seededDummy:true
   * 2. Old seeded reviews were named:
   *    [DEMO CROWD] Demo Student A
   */
  const deleted = await Review.collection.deleteMany({
    $or:[
      { seededDummy:true },
      { author:{ $regex:/^\[DEMO CROWD\]/ } }
    ]
  })

  console.log(
    `Removed ${deleted.deletedCount} previous dummy reviews`
  )

  const reviews = []

  // Create 5 dummy reviews for every study space
  for (const place of places) {
    for (let i = 0; i < 5; i++) {

      // Rotate through real registered accounts
      const userIndex =
        (place.id + i) % users.length

      const user = users[userIndex]

      // Rotate crowd levels
      const levelIndex =
        (place.id + i) % levels.length

      const level = levels[levelIndex]

      const createdAt =
        makeDate(place.id, i)

      reviews.push({
        placeId:place.id,

        // Real user's MongoDB ID
        userId:user._id,

        // Real current username
        author:user.name,

        // Rating from 3–5
        rating:3 + ((place.id + i) % 3),

        comment:pick(
          comments[level],
          place.id + i
        ),

        crowdLevel:level,

        createdAt:createdAt,
        updatedAt:createdAt,

        // Lets this script safely identify its own records
        seededDummy:true
      })
    }
  }

  await Review.collection.insertMany(reviews)

  console.log('')
  console.log(
    `Inserted ${reviews.length} dummy reviews`
  )

  console.log(
    `Used ${users.length} real registered accounts`
  )

  console.log(
    'Normal users and admins were included'
  )

  console.log(
    'Dummy crowd data seeded successfully'
  )

  await mongoose.disconnect()
}

seedReviews().catch(async error => {
  console.error(
    'Could not seed reviews:',
    error
  )

  await mongoose.disconnect()
  process.exit(1)
})