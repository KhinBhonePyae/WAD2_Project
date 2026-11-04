// Shared animation setup: GSAP (+ ScrollTrigger, Flip) and Lenis smooth scrolling.
// Everything checks reducedMotion so the site still works calmly for people
// who turn animations off in their system settings.
import gsap from 'gsap'  // Library: GSAP: GreenSock animation library (free "no charge" licence)
import { ScrollTrigger } from 'gsap/ScrollTrigger'  // Library: GSAP: GreenSock animation library (free "no charge" licence)
import { Flip } from 'gsap/Flip'  // Library: GSAP: GreenSock animation library (free "no charge" licence)
import Lenis from 'lenis'  // Library: Lenis: open-source smooth-scrolling library (MIT)
import 'lenis/dist/lenis.css'  // Library: Lenis: open-source smooth-scrolling library (MIT)

gsap.registerPlugin(ScrollTrigger, Flip)

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const finePointer = window.matchMedia('(pointer: fine)').matches

let lenis = null

export function startSmoothScroll() {
  if (reducedMotion || lenis) return
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(time => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
}

export function getLenis() {
  return lenis
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}

// Pause/resume page scrolling (used while the notebook intro is showing)
export function lockScroll(locked) {
  if (lenis) locked ? lenis.stop() : lenis.start()
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

export { gsap, ScrollTrigger, Flip }
