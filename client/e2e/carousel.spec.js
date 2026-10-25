import { test, expect } from '@playwright/test'

const LOAD = 15000

test.describe('Place Detail Image Carousel', () => {

  test('loads all carousel images and next/previous buttons work', async ({ page }) => {
    await page.goto('/places/1')

    const carousel = page.locator('#placeCarousel')
    await expect(carousel).toBeVisible({ timeout:LOAD })

    const slides = carousel.locator('.carousel-item')
    const images = carousel.locator('.place-carousel-image')

    // Li Ka Shing Library has 3 photos
    await expect(slides).toHaveCount(3)
    await expect(images).toHaveCount(3)

    // Check images actually loaded successfully
    for (let i = 0; i < 3; i++) {
      await expect(images.nth(i)).toBeVisible()

      const loaded = await images.nth(i).evaluate(img =>
        img.complete && img.naturalWidth > 0
      )

      expect(loaded).toBe(true)
    }

    // First slide starts active
    await expect(slides.nth(0)).toHaveClass(/active/)

    // NEXT → second image
    await carousel.locator('.carousel-control-next').click()

    await expect(slides.nth(1)).toHaveClass(/active/)

    // PREVIOUS → back to first image
    await carousel.locator('.carousel-control-prev').click()

    await expect(slides.nth(0)).toHaveClass(/active/)
  })


  test('carousel indicators can jump directly to another image', async ({ page }) => {
    await page.goto('/places/1')

    const carousel = page.locator('#placeCarousel')
    await expect(carousel).toBeVisible({ timeout:LOAD })

    const slides = carousel.locator('.carousel-item')
    const indicators = carousel.locator('.carousel-indicators button')

    await expect(indicators).toHaveCount(3)

    // Click indicator for image 3
    await indicators.nth(2).click()

    await expect(slides.nth(2)).toHaveClass(/active/)
  })

})