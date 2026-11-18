
 // ==UserScript==
 // @name         Eastern Panopto - Auto High Quality
 // @namespace    eastern-panopto-quality
 // @version      5.0
 // @description  Automatically select High quality on Eastern Panopto videos
 // @match        https://eastern.hosted.panopto.com/*
 // @run-at       document-idle
 // @grant        none
 // ==/UserScript==

 (() => {
   "use strict";

   if (window.__panoptoAutoHighV5) return;
   window.__panoptoAutoHighV5 = true;

   const LOG = "[Panopto Auto High]";
   const started = Date.now();
   const timeout = 45000;

   let finished = false;
   let lastAction = 0;
   let lastStep = "";
   let attempts = 0;

   function visible(el) {
     if (!el || !el.isConnected) return false;

     const s = getComputedStyle(el);

     return (
       s.display !== "none" &&
       s.visibility !== "hidden" &&
       el.getClientRects().length > 0
     );
   }

   function clickable(el) {
     return el.closest(
       'button, [role="button"], [role="menuitem"],' +
       ' [tabindex], .item, li, a'
     ) || el;
   }

   function findText(text) {
     const nodes = [...document.querySelectorAll(
       'span, div, button, li, a, [role="menuitem"]'
     )];

     return nodes
       .filter(visible)
       .filter(el => {
         const ownText = [...el.childNodes]
           .filter(n => n.nodeType === Node.TEXT_NODE)
           .map(n => n.textContent)
           .join(" ")
           .trim();

         return (
           ownText.toLowerCase() === text.toLowerCase() ||
           (el.getAttribute("aria-label") || "")
             .toLowerCase() === text.toLowerCase()
         );
       })
       .map(clickable)
       .find(visible) || null;
   }

   // Version 4's working Quality detection.
   function findQuality() {
     const elements = [...document.querySelectorAll(
       'div, span, li, button, [role="menuitem"]'
     )].filter(visible);

     for (const el of elements) {
       const ownText = [...el.childNodes]
         .filter(n => n.nodeType === Node.TEXT_NODE)
         .map(n => n.textContent.trim())
         .join(" ")
         .trim();

       if (/^quality$/i.test(ownText)) {
         return clickable(el);
       }
     }

     return elements.find(el => {
       const text = el.textContent.trim()
         .replace(/\s+/g, " ");

       return /^Quality\s+(Auto|Automatic|Low|Medium|High)/i
         .test(text) &&
         text.length < 90;
     }) || null;
   }

   // Restored and expanded Version 3 Settings detection.
   function findSettings() {
     const selectors = [
       "#settingsButton",
       "#settings",
       '[data-automation-id*="settings" i]',
       '[aria-label="Settings" i]',
       '[title="Settings" i]',
       ".fp-settings",
       ".flowplayer .fp-settings",
       '[class*="settings" i]'
     ];

     for (const selector of selectors) {
       const matches = document.querySelectorAll(selector);

       for (const el of matches) {
         if (!visible(el)) continue;

         const target = el.closest(
           'button, [role="button"], .overlay-button'
         ) || el;

         if (visible(target)) return target;
       }
     }

     // Version 3 fallback: search visible controls.
     const controls = [...document.querySelectorAll(
       'button, [role="button"], [title], ' +
       '.overlay-button, .material-icons, i'
     )].filter(visible);

     for (const el of controls) {
       const text = [
         el.getAttribute("aria-label"),
         el.getAttribute("title"),
         el.textContent
       ].filter(Boolean).join(" ").trim();

       if (
         /^(settings|video settings)$/i.test(text) ||
         (
           /settings/i.test(text) &&
           text.length < 60
         ) ||
         (
           el.classList.contains("material-icons") &&
           /^(settings|tune)$/i.test(
             el.textContent.trim()
           )
         )
       ) {
         return clickable(el);
       }
     }

     return null;
   }

   function performClick(el, step) {
     if (!el || !visible(el)) return false;

     // Avoid rapid duplicate clicks.
     if (
       lastStep === step &&
       Date.now() - lastAction < 1500
     ) {
       return false;
     }

     console.log(LOG, "Clicking:", step, el);

     el.click();

     lastAction = Date.now();
     lastStep = step;

     return true;
   }

   function run() {
     if (finished) return;

     if (Date.now() - started > timeout) {
       console.warn(
         LOG,
         "Timed out. Last action:",
         lastStep
       );
       clearInterval(timer);
       return;
     }

     if (Date.now() - lastAction < 750) return;

     const player = document.querySelector(
       "#player, .flowplayer, video"
     );

     if (!player) return;

     attempts++;

     // STEP 3: Select High when available.
     const high = findText("High");

     if (high) {
       if (performClick(high, "High")) {
         finished = true;
         clearInterval(timer);

         console.log(
           LOG,
           "SUCCESS: High quality selected"
         );
       }
       return;
     }

     // STEP 2: Open Quality submenu.
     const quality = findQuality();

     if (quality) {
       performClick(quality, "Quality");
       return;
     }

     // STEP 1: Open Settings gear.
     const settings = findSettings();

     if (settings) {
       performClick(settings, "Settings");
       return;
     }

     if (attempts % 10 === 0) {
       console.log(
         LOG,
         "Waiting for player controls..."
       );
     }
   }

   const timer = setInterval(run, 500);

   console.log(
     LOG,
     "Version 5.0 initialized"
   );
 })();
