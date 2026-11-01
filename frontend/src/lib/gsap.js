import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(Flip, MotionPathPlugin, Observer, ScrollTrigger);

export { Flip, MotionPathPlugin, Observer, ScrollTrigger, gsap };
