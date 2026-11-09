/* Bass Assembly: apply the saved theme before the first paint, so the light theme
   does not flash dark while app.js loads. Loaded in <head>, without defer. MIT License. */
"use strict";
try {
  if (localStorage.getItem("bassassembly-theme") === "white") {
    document.documentElement.setAttribute("data-skin", "white");
    // Same color as --bg of the light theme in style.css.
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#e9e9e9");
  }
} catch (e) {}
