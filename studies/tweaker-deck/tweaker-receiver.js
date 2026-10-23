/* tweaker-receiver.js — drop into a real page (dev/preview only) so a tweaker can drive
   it inside its viewport. It writes every CSS custom property the tweaker sends onto
   :root, and re-dispatches the values as a 'tweak' event for JS-driven parameters:

     addEventListener('tweak', function (e) { var v = e.detail.values; ... });
     addEventListener('tweak-replay', function () { ...restart the motion... });

   Never ship it to production — it trusts any window that posts to it. */
(function () {
  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.tweaker) return;
    (d.css || []).forEach(function (c) { document.documentElement.style.setProperty(c[0], c[1]); });
    if (typeof d.speed === 'number') {
      document.getAnimations().forEach(function (a) { a.playbackRate = d.speed; });
      if (window.gsap) window.gsap.globalTimeline.timeScale(d.speed || 0.0001);
    }
    dispatchEvent(new CustomEvent('tweak', { detail: { values: d.values } }));
    if (d.replay) dispatchEvent(new CustomEvent('tweak-replay'));
  });
})();
