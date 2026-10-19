/* Optional custom Motion transitions.
   Add entries to this map and select them with data-transition="your-name".
   Each handler receives { from, to, axis, direction, kind, duration, animate, reducedMotion }.
*/
window.webPresentationTransitions = window.webPresentationTransitions || {};

// Example:
// window.webPresentationTransitions.wipe = async ({ from, to, direction, duration, animate }) => {
//   await Promise.all([
//     animate(from, { opacity: [1, 0] }, { duration: duration * 0.45 }).finished,
//     animate(to, { opacity: [0, 1] }, { duration }).finished
//   ]);
// };
