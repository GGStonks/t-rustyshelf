// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): most of this file is Boxshelf's
// renderer/whatsnew.js; modified for (T)rustyShelf (its own versions' notes).
// What's new: each version's notes, shipped with the app (so the card after an update works offline, and on the Thor).
// The shelf shows a version's highlights once, the first time it starts; Settings → System → What's new lists the
// items (a short headline per row; the side card says more). scripts/release-notes.js prints the same notes as Markdown
// for the GitHub release, so the app and the release page always say the same thing.
// { version (Windows / Linux), android (the Android build with the same changes, if any), date, title, highlights[],
//   sections: [{ h, items: [[headline, more]] }] }; newest first.
window.BS_WHATSNEW = [
  {
    version: '1.8.0.0', android: '1.8.0.0', date: '2026-11-12', title: "Minecraft and Store apps on the shelf, a smooth museum with a big library, and no hang at launch",
    highlights: [
      "No more endless hang at launch while Steam's files are read",
      "Minecraft for Windows shows up, and any Microsoft Store app can be added by hand",
      "The museum stays smooth with thousands of games, on wider, lower shelves",
      "RetroArch is one of the choices for every console it runs, the PlayStation included",
      "The box art check before a download is quick and shows where it is"
    ],
    platforms: [
      "Windows and Linux: the launch fix, Quiver's app names, RetroArch for every console it runs, the quick box art check.",
      "Windows: Minecraft for Windows and Microsoft Store apps.",
      "All platforms: the museum with a big library, card boxes without a frame."
    ],
    sections: [
      { h: "Starting up", items: [
        ["No hang at launch", "Reading Steam's settings files could go round forever on a file with an unusual space character in it (a no-break space, for example), and the app stayed \"not responding\" right after \"Steam: found it\". The reader always moves forward now, so the app starts."]
      ] },
      { h: "PC games", items: [
        ["Minecraft for Windows", "Older Microsoft Store games are installed in Windows' protected WindowsApps folder rather than an Xbox games folder, so they never showed. Minecraft for Windows is found now, and starts as its Store app."],
        ["Microsoft Store apps by hand", "Settings → Custom games → Add games → Add Microsoft Store apps lists the Store apps on your PC: tick the games you want and they go on the Custom shelf, each started as the Store app it is."],
        ["Quiver app names", "Apps Quiver installed after the first import got their folder's name and no box art. They now take the name Quiver's own list gives them (and the name you gave them in Quiver), so their covers are found like the others'."]
      ] },
      { h: "Consoles", items: [
        ["RetroArch for every console it runs", "A console's page lists the RetroArch set in Settings too, wherever it's kept, so the PlayStation can go from DuckStation to RetroArch and its cores (SwanStation, Beetle PSX, PCSX ReARMed) in one press."],
        ["Card boxes without a frame", "SNES, Game Boy Advance and the other consoles in printed card boxes no longer have a case-coloured frame round the cover: it runs right to the edges, like the real box. Plastic cases keep theirs."]
      ] },
      { h: "Box art", items: [
        ["A quick check before the download", "Download missing art now no longer reads every games folder again before it starts: it uses the library (T)rustyShelf already has, says which console it's checking, and keeps going while you look at other pages."]
      ] },
      { h: "Museum", items: [
        ["Smooth with a big library", "A row whose cases are small on screen is drawn as one block with a picture of its spines, instead of every case on its own: the wide view of a wall of thousands of games takes about 40 times fewer drawings a frame. Rows close by and the one you're on keep their real cases."],
        ["Wider, lower shelves", "A console now fills up to 240 games a shelf before it continues below (120 before), so a big library makes a wider, lower wall."]
      ] }
    ]
  },
  {
    version: '1.7.0.0', android: '1.7.0.0', date: '2026-11-12', title: "A PS Vita shelf, Steam achievements, the emulator and core you want, and a quicker export",
    highlights: [
      "A PS Vita shelf, played in Vita3K",
      "Steam games show their achievements in Details",
      "Each console lists every emulator found, and RetroArch consoles let you pick the core",
      "Export everything says how big it is, can pause and cancel, and only copies what changed the next time",
      "Xbox app games show up when two or more are installed"
    ],
    platforms: [
      "Windows and Linux: the PS Vita shelf, Steam achievements, the emulator and core choices, BizHawk, Gopher64 and RAProject64, Export everything, keeping the PC awake, gamelist.xml names and art.",
      "Windows: the Xbox app's games.",
      "All platforms: the boot sound's own volume, the museum's lamps, the cases in Inspect."
    ],
    sections: [
      { h: "Consoles", items: [
        ["PS Vita", "A new shelf for the PS Vita, in Vita3K. The games Vita3K has installed are found by themselves (its ux0 folder, wherever its settings keep it), named from each game's own info, and start straight in, fullscreen. A .vpk in a psvita folder is handed to Vita3K, which installs it and runs it."],
        ["Every emulator found", "A console's page in Settings lists every emulator (T)rustyShelf found for it, each one press away: Flycast or RetroArch for the Dreamcast, Gopher64, RMG or RetroArch for the N64. Details → Emulator still lets a single game use another one."],
        ["RetroArch core of your choice", "Consoles that run in RetroArch have a RetroArch core choice: FCEUmm, Nestopia or QuickNES for the NES, bsnes for the SNES, PCSX ReARMed or Beetle PSX for the PlayStation, and others. A core that isn't there yet is downloaded the first time you play."],
        ["BizHawk, Gopher64 and RAProject64", "These portable emulators with RetroAchievements built in are found by Find emulators in a folder and by the usual search, and each starts with its own options. BizHawk is used only when there's nothing else for a console, or when you pick it."],
        ["Batocera and RetroBat gamelists", "A games folder with a gamelist.xml (Batocera, RetroBat and EmulationStation keep one) gives its games their names, and its box art, back covers, cartridges, pictures and PDF manuals, so nothing has to be downloaded again. Art (T)rustyShelf already has for a game comes first."]
      ] },
      { h: "PC games", items: [
        ["Steam achievements", "A Steam game's Details shows its achievements, read from what Steam keeps on your PC: how many you've unlocked, and the full list with icons and unlock dates. Hidden ones stay hidden until you earn them. GOG, EA and Ubisoft keep theirs where they can't be read this way."],
        ["Xbox app games", "With two or more Xbox app or Game Pass games installed, Windows refused the question (T)rustyShelf asked about them, so they all looked uninstalled. Each game is asked about on its own now, and the wrong answers saved before are thrown away."]
      ] },
      { h: "Export everything", items: [
        ["Its size first", "Settings → System → Export everything says how big the export will be before you choose a folder."],
        ["Progress, Pause and Cancel", "While an export or import runs, its row shows the size and files done, the time left, and Pause / Resume and Cancel rows. A cancelled export keeps what it copied."],
        ["Only what changed", "Export into the same folder again and the earlier export is updated: only new or changed files are copied, so the second run of a big collection is quick."]
      ] },
      { h: "Sound and power", items: [
        ["Boot sound volume", "Settings → Sound → Boot sound volume sets how loud the boot sound plays, on its own, without making the menu sounds quieter."],
        ["The PC kept awake", "While box art downloads, an export or import runs, Add games reads a folder or the box art database is rebuilt, the PC doesn't go to sleep, and goes back to normal when it ends. Settings → System → Keep the PC awake during long jobs turns it off."]
      ] },
      { h: "Museum and Inspect", items: [
        ["Lamps on the right shelf", "In the wide view of a big wall, the shared lamps follow the gold frame, instead of staying where you last looked."],
        ["Each console's own case", "In Inspect, each console opens into the case its games came in: modelled PS2, Wii, Wii U and GameCube cases, jewel cases for CD consoles, card boxes for cartridge consoles."]
      ] }
    ]
  },
  {
    version: '1.6.2.0', android: '1.6.2.0', date: '2026-11-12', title: "Xbox app games that show up, and disc cases that look like disc cases inside",
    highlights: [
      "Xbox app and Game Pass games no longer stay \"not installed\" after Windows didn't answer once",
      "A disc game's 3D case no longer has a cartridge holder inside"
    ],
    platforms: [
      "Windows: the Xbox app's games.",
      "All platforms: the 3D case in Inspect."
    ],
    sections: [
      { h: "PC games", items: [
        ["Xbox app games", "If Windows didn't answer which Xbox games are installed (it can time out at startup), every game used to be remembered as not installed for good. Only a real answer is remembered now, a game Windows said isn't installed is asked about again a day later, and without an answer the games in the Xbox games folders show anyway. A game whose settings file is saved as UTF-16 is found too."]
      ] },
      { h: "Inspect", items: [
        ["Disc cases inside", "The 3D case is a cartridge case underneath, and a disc game's case showed its card holder under the disc, like a 3DS case. Disc cases leave it out now, with plain plastic where it was; DS, 3DS and Switch cases keep the holder their cartridge sits in."]
      ] }
    ]
  },
  {
    version: '1.6.1.0', android: '1.6.1.0', date: '2026-11-11', title: "No more hang at launch on a sleeping drive, and DS boxes the size of their covers",
    highlights: [
      "A Steam library on a drive that's asleep or unplugged no longer freezes the window at launch",
      "Switch 2 builds that open .nup games aren't greyed out any more",
      "DS boxes are as wide as their covers, and DS cartridges have their contacts on the back only"
    ],
    platforms: [
      "Windows and Linux: the Steam read at launch, the stall watch in the log, the Switch 2 build check.",
      "All platforms: the DS box and cartridge."
    ],
    sections: [
      { h: "Startup", items: [
        ["No hang on a sleeping drive", "Steam's libraries are read without holding the window up, and a library on a drive that doesn't answer within a few seconds (asleep, unplugged, a network share gone) is left out until the next start, with a line in the log saying so."],
        ["A stall says where it is", "If the app ever gets stuck, the log says so while it's happening, after 5 s, 15 s, 30 s and on, naming the step it was on, instead of nothing at all."]
      ] },
      { h: "Switch 2", items: [
        ["Builds that open .nup", "Fortune's Eden and other builds that open .nup games but name the format differently inside their program are no longer greyed out at Play. A build (T)rustyShelf can't be sure about stays startable, marked \"may not open .nup games\"."]
      ] },
      { h: "DS", items: [
        ["The box fits the cover", "DS boxes have the same proportions as the 3DS case they match in size, so a DS cover fills its front instead of losing its sides."],
        ["The cartridge's contacts", "The gold contacts sit on the back of the cartridge only, in Inspect and in the museum, not over the label."]
      ] }
    ]
  },
  {
    version: '1.6.0.0', android: '1.6.0.0', date: '2026-11-11', title: "A real 3D game case in Inspect, a lighter museum for big libraries, and PC box colours",
    highlights: [
      "Inspect opens a real 3D case: a booklet you can read, a cartridge that comes out, a clear Switch case",
      "The museum stays quick with big libraries: long consoles continue on the shelves below",
      "PC games in their console box can take one colour, or one per console",
      "One press resumes a stopped box art download, or gets all missing art",
      "A DualSense the shelf got nothing from over Bluetooth now works"
    ],
    platforms: [
      "Windows: the PlayStation pad fallback, PCSX2's RetroAchievements sign-in in a moved Documents or business OneDrive folder.",
      "Linux: PCSX2's sign-in in ~/.config and the Flatpak; the PC games folder read without holding the app up.",
      "All platforms: the 3D case, the museum, PC box colours, box art resume, manual sorting, Quiver, Add games and the Switch fixes."
    ],
    sections: [
      { h: "Inspect and the cases", items: [
        ["A real 3D game case", "Inspect opens one case model for every console, closed the right way up: a white inside page, a booklet you can click and read, a cartridge you can take out and turn in place, and the disc docked inside. The shelf's box is drawn to match the case it turns into."],
        ["Switch and PC cases", "The Switch case is clear plastic with its two hinges and the art wrapped round the spine; PC games keep a clean cover without a coloured frame, always say PC on the spine, and can be inspected too. Inspect is no longer offered on the emulator and Surprise me tiles."]
      ] },
      { h: "Museum", items: [
        ["Big libraries stay quick", "A console with more than 120 games continues on the shelves below, split evenly, its plaque saying which part it is (PS2 · 2 of 3), so the wide view no longer pulls back across one endless row. Past ten shelves, three lights follow the row you're on instead of one per shelf, which keeps the room smooth."]
      ] },
      { h: "PC games", items: [
        ["Console box colour", "Settings → PC games → Console box color: keep each console's own (PlayStation blue, Xbox green), give every PC game one colour (dark blue, black, white…), or set one per console in Box color per console."],
        ["The case follows the cover", "A Steam or SteamGridDB cover chosen for a game that also had a console box no longer comes out in that console's case and proportions."],
        ["Quiver apps", "Apps Quiver installed after the first import get their case: Quiver's apps folder is looked through too, without doubling anything."],
        ["Add games from a folder", "A games folder sorted into category folders (Racing, 2D games…) is stepped into, each game inside its own entry, and the folders left out are listed with the reason (only an installer, an archive)."]
      ] },
      { h: "Box art", items: [
        ["Resume or get all missing art", "Settings → Box art & manuals starts with one row: Resume box art download picks a stopped download up with the same consoles and parts; with nothing to resume, Get all missing art gets every console still missing covers, backs, spines or discs."]
      ] },
      { h: "Shelf and controllers", items: [
        ["Manual sorting with the mouse", "A quick drag scrolls the shelf and no longer grabs a box; hold a box still for a moment to pick it up. The shelf no longer keeps scrolling after a drop, and Custom can be left for A–Z or the others at once."],
        ["PlayStation pads over Bluetooth", "A DualSense Windows has but the shelf got nothing from is read directly by (T)rustyShelf's controller helper, so it moves the shelf; a pad the shelf sees itself turns that off."],
        ["Switch games folder", "The .nca parts of a dump no longer show up as games of their own."]
      ] },
      { h: "Achievements and startup", items: [
        ["PCSX2 sign-in found", "RetroAchievements shows PCSX2 as signed in when its settings live in a moved Documents folder, a business or translated OneDrive folder, ~/.config/PCSX2 or the Flatpak."],
        ["No hang at launch", "The PC games folder is read without holding the app up (a sleeping hard drive or a NAS could leave the window not responding), and a slow startup step is named in the log."]
      ] }
    ]
  },
  {
    version: '1.5.2.0', android: '1.5.2.0', date: '2026-11-10', title: "Startup auto-update with automatic restart and startup trailer suppression",
    highlights: [
      "Optional automatic update check at startup with background download",
      "Automatic 5-second restart prompt once updates are applied without manual downloading",
      "Suppressed background video trailers from auto-playing on initial app startup"
    ],
    platforms: [
      "Linux and Windows: optional startup auto-update check and automatic restart countdown.",
      "All platforms: background video trailer suppression on initial startup."
    ],
    sections: [
      { h: "Updates and startup", items: [
        ["Startup auto-update", "You can now enable automatic update checking at startup in Settings → System. When enabled, (T)rustyShelf checks for newer releases in the background, downloads and installs updates automatically without manual downloading, and alerts you with a 5-second countdown before restarting."],
        ["Startup video trailer suppression", "Background video trailers are now suppressed on initial app launch until you browse or navigate the shelf, preventing trailers from auto-playing unexpectedly on startup."]
      ] }
    ]
  },
  {
    version: '1.5.1.0', android: '1.5.1.0', date: '2026-11-10', title: "Citron Switch emulator crash fix and Linux environment cleanup",
    highlights: [
      "Nintendo Switch games boot reliably in Citron without crashing on launch",
      "Automatic restoration of configured game directories when Citron exits",
      "Sanitized AppImage environment variables for child processes on Linux"
    ],
    platforms: [
      "Linux and Windows: Citron directory scanning race condition fix and automatic restoration.",
      "Linux: child process environment sanitization preventing AppImage library pollution."
    ],
    sections: [
      { h: "Consoles and emulators", items: [
        ["Citron Switch launch fix", "Fixed a crash when launching Nintendo Switch games through Citron. Citron's background directory scanning threads previously raced with game booting and UI teardown when multiple game folders were configured; (T)rustyShelf now safely caps game directories to internal NAND at launch and transparently restores all configured game folders when the emulator exits."],
        ["Child process environment sanitization", "On Linux, emulators and child processes launched from the (T)rustyShelf AppImage no longer inherit APPDIR and bundled library search paths, preventing dynamic linker and library conflicts."]
      ] }
    ]
  },
  {
    version: '1.5.0.0', android: '1.5.0.0', date: '2026-11-09', title: "Shared RetroArch setup, ScreenScraper login fallback, brighter museum and export fixes",
    highlights: [
      "Set your RetroArch executable once in Consoles settings across all retro systems",
      "ScreenScraper login works with developer username and password alone",
      "Museum lighting is brighter across all presets, with extended fog distance in wide view",
      "Data export handles Windows drive roots and retries locked or busy files"
    ],
    platforms: [
      "Windows and Linux: everything above.",
      "Android: ScreenScraper developer login fallback, museum lighting and fog visibility improvements."
    ],
    sections: [
      { h: "Consoles and emulators", items: [
        ["Shared RetroArch setup", "Settings → Consoles now has a shared 'RetroArch location' under 'For every console'. Setting it once configures all supported retro systems (NES, SNES, N64, Genesis, PS1, Saturn, Dreamcast, GBA, NDS, Arcade, DOS, etc.) without having to set each console emulator manually. Individual console emulator paths can still be set to override the shared setting. Asked for by retro_fan on GitHub (#12)."]
      ] },
      { h: "Scraping and metadata", items: [
        ["ScreenScraper developer credentials fallback", "Entering your ScreenScraper developer username and developer password without a separate developer ID now logs in cleanly, falling back to the username. Asked for by retro-dan on GitHub (#13)."]
      ] },
      { h: "Museum", items: [
        ["Museum lighting and visibility", "Lighting presets (Classic, Evening, Neon, Spotlit, Lights out) have lifted ambient, fill, moon, and environment intensities. Fog near and far distances are pushed back so models along long shelves and wide overviews stay crisp and visible instead of fading into dark haze. Fill light is also boosted when viewing the whole room. Reported by @retro-enjoyer in issue 30."]
      ] },
      { h: "Data export and fixes", items: [
        ["Windows root and busy files in data export", "Exporting your library to a drive root on Windows (like D:\\ or E:\\) no longer errors. Files that are temporarily locked or busy by other programs are safely retried before falling back to read streams. Asked for by pixel-runner on GitHub (#11)."]
      ] }
    ]
  },
  {
    version: '1.4.0.0', android: '1.4.0.0', date: '2026-11-09', title: "Tour, YouTube trailers, achievements on 25 consoles, manual sorting and more",
    highlights: [
      "A shelf tour for new players and a full-screen first-run setup",
      "Trailers searched on YouTube when the LaunchBox link is gone, and prepared ahead for neighbours",
      "Achievements on 25 consoles (was 4), Trophies opens the game's set at once",
      "Magazine and guide downloads show real sizes, speed, and resume interrupted transfers",
      "Museum: pick up a magazine, add a 3D model for consoles that don't have one",
      "Manual sorting with drag and drop, an All games shelf, auto-hide hints, and box scaling per game"
    ],
    platforms: [
      "Windows and Linux: everything above.",
      "Android: achievements on 25 consoles, text size options with system font scale detection, Art Studio layout lifting."
    ],
    sections: [
      { h: "New player experience", items: [
        ["Shelf tour", "Nine guided steps introduce the shelf, Details, Inspect, the quick menu, the Art Studio and Settings. A controller works throughout. Starts on first run after setup; Settings → Shelf → Show the tour restarts it. Not on Android. By sassiestrhihno."],
        ["Full-screen first-run setup", "A full-screen setup wizard on Windows on a fresh install, with a sidebar showing progress and a hint pill under each step. By sassiestrhihno."]
      ] },
      { h: "Trailers and previews", items: [
        ["YouTube trailer search", "When a game's LaunchBox trailer link is gone (private or removed), or there is none, (T)rustyShelf searches YouTube for its trailer instead. The result is remembered per game. By sassiestrhihno."],
        ["Neighbours prepared ahead", "The clips for the two games either side of the one you're on are made in the background, so they play at once when you get there. By sassiestrhihno."],
        ["No-clip notice", "When no clip is coming (the link is gone and nothing fits on YouTube), the waiting box closes straight away instead of after 45 seconds. By sassiestrhihno."]
      ] },
      { h: "Achievements", items: [
        ["25 consoles", "RetroAchievements covers 25 consoles in (T)rustyShelf (was 4): all the ones the site supports. Each shelf shows its set count and a 'why there\'s nothing' message when the game has none. By sassiestrhihno."],
        ["Trophies opens the game's set", "The Trophies button in Inspect opens that game's achievement set page on RetroAchievements directly. By sassiestrhihno."]
      ] },
      { h: "Magazines and guides", items: [
        ["Real sizes and speed", "The download card shows the file's actual size, the current speed and an estimated time left. By sassiestrhihno."],
        ["Resume interrupted downloads", "An interrupted download picks up where it stopped. A file over 500 MB asks before starting. By sassiestrhihno."]
      ] },
      { h: "Museum", items: [
        ["Pick up a magazine", "In the museum you can pick up a magazine from a file box's fan and put it back. The file-box fan works cleanly when there are many items. By sassiestrhihno."],
        ["3D model for consoles", "Consoles that didn't have a 3D model in the museum get one now. By sassiestrhihno."]
      ] },
      { h: "Library and display", items: [
        ["All games shelf", "Settings → Shelf → All games shelf adds an alphabetical shelf with every game across all consoles, each in its authentic 3D box."],
        ["Manual sorting", "Sort panel (G) → Custom lets you drag games into your own order. Keyboard shortcuts: [ and ] or Shift + Arrows. Details More has Move earlier and Move later."],
        ["Box scaling", "Settings → Display → Box scale sets the size from 80% to 120%. Details More → Box size scales an individual game."],
        ["Auto-hide hints", "Settings → Display → Auto-hide navigation shortcuts fades the shortcut bar out after 4 seconds of inactivity; any input brings it back."]
      ] },
      { h: "Inspect and display", items: [
        ["Xbox 360 covers wrap the case", "Xbox 360 box art wraps around the case the way retail boxes do. By sassiestrhihno."],
        ["DOS games on floppy disks", "DOS games show a floppy disk instead of a cartridge in Inspect. By sassiestrhihno."],
        ["Discs spin on Windows", "Disc art spins while a game loads on the Windows build. By sassiestrhihno."],
        ["Settings switches", "Settings → Display: toggle box shine, the Surprise me tile, and the emulator case. Controller swap A/B prompt. By sassiestrhihno."]
      ] },
      { h: "Add games and PC", items: [
        ["Folder scan improvements", "Names with hyphens and dots are matched correctly. Linux executables (.sh, .x86_64, .bin) are found. Local cover art (cover, folder, box, front) is detected and imported automatically."],
        ["Bulk add UX", "Select all / Deselect all and Add the ticked games buttons are at the top of the scan results."],
        ["PC console box geometry", "PC games that use a console's cover art render with that console's exact case dimensions and depth, so the art fits properly. Steam branding is never cropped."]
      ] },
      { h: "Android", items: [
        ["Text size options", "Settings → Display → Text size on Android: Small, Default, Large, or the system font scale. Art Studio lifts when the keyboard opens. By sassiestrhihno."]
      ] },
      { h: "Fixes and other changes", items: [
        ["GitHub bug report form", "Issues on GGStonks/t-rustyshelf now have a template with version and device fields, and a chooser that sends ideas and questions to Discussions. By sassiestrhihno."],
        ["Quick menu sounds and Steam covers", "Quick menu: sound-related settings in one place; Steam covers shown in Inspect. Museum PDF range mode; Details smooth glide. By sassiestrhihno."],
        ["CI and repo parity", "Demo tests updated for the new tiles; Android package bumped to match beta.11."]
      ] }
    ]
  },
  {
    version: '1.3.0.0', android: '1.3.0.0', date: '2026-11-09', title: "Neo Geo Pocket, Neo Geo Pocket Color and Game.com shelves",
    highlights: [
      "A Neo Geo Pocket shelf and a Neo Geo Pocket Color shelf, played in RetroArch's Beetle NeoPop core",
      "A Game.com shelf, played in MAME",
      "Each with its own box art, manuals and card box"
    ],
    platforms: [
      "Windows and Linux: all three shelves.",
      "Android (AYN Thor): the Neo Geo Pocket and Neo Geo Pocket Color shelves, through RetroArch."
    ],
    sections: [
      { h: "New shelves", items: [
        ["Neo Geo Pocket and Neo Geo Pocket Color", "One shelf for each, as their box art is kept apart: .ngp games in an ngp or Neo Geo Pocket folder, .ngc games in an ngpc or Neo Geo Pocket Color folder. They play in RetroArch's Beetle NeoPop core (no BIOS needed; on Windows the core is downloaded the first time), with box art from libretro and LaunchBox, manuals from GamesDatabase.org and small card boxes of their own. On the Thor too. Asked for by ShayneVi."],
        ["Game.com", "Tiger's handheld gets a shelf: .tgc or .bin games in a gamecom or Game.com folder, started in MAME. MAME needs the Game.com's own system file (gamecom.zip, from a MAME BIOS set) in its roms folder first; Setup and Settings say so. Asked for by ShayneVi."]
      ] }
    ]
  },
  {
    version: '1.2.0.0', android: '1.2.0.0', date: '2026-11-08', title: "Art match for console games, and console box art that shows",
    highlights: [
      "Art match: pick by name which game a console game's box art comes from, for ROM hacks, translations and mods",
      "Console box art for PC games shows again: the covers had gone back to the made-up cases",
      "Automatic PC posters show too",
      "Settings → Controller says what to do when a PlayStation pad does nothing while Steam is open"
    ],
    platforms: [
      "Windows and Linux: everything above.",
      "Android: no changes in this release."
    ],
    sections: [
      { h: "Box art", items: [
        ["Art match", "A ROM hack, a translation or a mod named after its serial or file name got no box art. Details → Art match searches the console's games in the box art databases by name: pick the right one and its box art is fetched for this game, and remembered. Back to automatic undoes it. Asked for by jhonam05 in (T)rustyShelf's issue 2."],
        ["Console box art shows again", "With Settings → PC games → Console box art on, the console boxes were made but never shown: the shelf fell back to the made-up cases. They show now, back and spine too. Reported by jhonam05 in (T)rustyShelf's issue 1."],
        ["Automatic PC posters", "The automatic SteamGridDB posters and store box art for PC games had the same problem, and show now as well."]
      ] },
      { h: "Controllers", items: [
        ["PlayStation pads and Steam", "While Steam is open, Steam Input can take a DualSense or DualShock 4 for itself. Settings → Controller now says so and where to turn it off: \"PlayStation pad does nothing?\""]
      ] }
    ]
  },
  {
    version: '1.1.0.0', android: '1.1.0.0', date: '2026-11-08', title: "Window modes, HoYoPlay, Epic downloads, your own music and saved looks",
    highlights: [
      "A window mode for each PC game (borderless or windowed), a HoYoPlay shelf, and a start through Windows' administrator prompt",
      "Epic downloads on Linux: a queue with Pause and Resume, an installation status, and a Storage view by drive",
      "Your own music (a Music folder) as the menu music, and saved looks: a whole look in one press",
      "An original Xbox shelf (xemu), Portuguese (Brasil), a Discord \"Playing\" status and Export / Import everything",
      "A start script for Linux, and PC games in their console box"
    ],
    platforms: [
      "Windows: the window mode, HoYoPlay and the administrator start (they use Windows itself).",
      "Linux: the Epic download manager, the installation status and the start script (start-trustyshelf.sh).",
      "Windows and Linux: your own music, Storage, Export / Import everything and the Discord status.",
      "Windows, Linux and Android: saved looks, the Installed filter and the language choice."
    ],
    sections: [
      { h: "PC games", items: [
        ["A window mode for each PC game", "Details → Window, on a PC game the shelf starts itself (Quiver, GOG, HoYoPlay, the PC games folder, programs you added): Borderless takes the frame and title bar off and stretches the game over its screen; Windowed keeps the game a window and leaves the taskbar. Windows only. The idea is from the TyroShelf fork."],
        ["A HoYoPlay shelf", "Genshin Impact, Honkai: Star Rail, Zenless Zone Zero and Honkai Impact 3rd, as HoYoPlay installed them, are on the PC shelf and start from their own folders. Settings → PC games → Show installed HoYoPlay games. Windows. The idea is from the TyroShelf fork."],
        ["Administrator rights", "A program that needs administrator rights is started through Windows' own prompt, instead of not starting. Windows."],
        ["Epic downloads", "Installs and updates run in a queue, one at a time: progress, speed and time left, Pause and Resume (what was downloaded stays, the download goes on from there), Move up and Remove. Settings → PC games → Downloads, and an Epic downloads row in the quick menu. Linux, through legendary as before."],
        ["Installed or not", "Details → Installation sets an Epic game to installed or not installed by hand (a game that is not installed is greyed, and Play offers to install it); another press goes back to what the shelf finds. Linux."],
        ["Storage", "Settings → PC games → Storage lists every installed PC game with its size, by drive, and how much room each drive has."],
        ["An Installed filter", "The Sort panel's filter row has Installed when some of your games are greyed, so the shelf can show only what you can play now."],
        ["PC games in their console box", "Settings → PC games → Console box art (off by default): each PC game shows the box of its newest console release, with the back and spine too, and a Steam band over the console's logo."]
      ] },
      { h: "Look and sound", items: [
        ["Your own music", "Put music files (mp3, ogg, opus, wav, flac, m4a, aac and more) in the Music folder beside the app, or in Songs; subfolders count. Settings → Sound → Menu music → Your music plays them one after another, never the same twice running. Reload music reads the folder again. Up to 500 files. The idea is from the TyroShelf fork."],
        ["Saved looks", "Settings → Display → Looks keeps the look you have now (theme, background, interface size, clock, home layout, order, filter, sound and menu music, museum scene) under a name; Apply puts it all back in one press. Rename, Update and Delete are there too. The idea is from the saved workspaces of the 0libote launcher."],
        ["Português (Brasil)", "Settings → Display → Language. The translation is from Thanks2111's fork; the screen reloads to switch."],
        ["Discord status", "Settings → Display → Show what I'm playing on Discord: while a game runs, your profile says Playing with its name. Off by default; it needs a free Discord application id and only talks to the Discord app on your computer."],
        ["Home on Linux", "The Home key, the Guide button and the menu request open the quick menu in the shelf's own window, where the keyboard and controller work."]
      ] },
      { h: "Consoles and emulators", items: [
        ["An original Xbox shelf", "Disc images (.iso, .xiso) from an xbox folder, started in xemu full screen, with box art, manuals and a black Xbox case. xemu needs its BIOS, boot ROM and hard disk set up first."],
        ["Portable emulators", "Settings → Consoles → Find emulators in a folder looks for every emulator (T)rustyShelf knows in a folder you choose, four folders deep, even on another drive; RetroAchievements shows whether DuckStation, RetroArch and Flycast are signed in, portable or installed."],
        ["More emulators found", "DeSmuME for the DS, VisualBoyAdvance-M for the Game Boy shelves, and more DuckStation builds are found and started."],
        ["Switch 2 sizes", "Unpacked Switch 2 games (a folder with exefs and romfs) show their size."]
      ] },
      { h: "Your data and the app", items: [
        ["Export everything, Import everything", "Settings → System: copy your whole collection (settings, favourites, history, art databases, themes, songs, and the art and manuals next to your games) to a folder, and bring it back on another PC. Nothing is deleted on import."],
        ["A start for Linux", "start-trustyshelf.sh runs (T)rustyShelf from the source on any Linux with Node.js: it installs what it needs on the first run and repairs Electron if its download failed. --windowed starts in a window; the idea is from wouldja's launcher."],
        ["Versions and updates", "The version reads like the releases (1.1.0.0), the wording says Updates instead of beta, and the update check reads this repository's releases."]
      ] }
    ]
  },
  {
    version: '1.0.1.0', android: '1.0.1.0', date: '2026-11-08', title: 'Custom games on any shelf, and fixes from Boxshelf\'s reports',
    highlights: [
      'Custom games: each gets its own page, with launch arguments and a Platform: Custom, PC or any console\'s shelf',
      'An Xbox One shelf for PC ports, and automatic SteamGridDB posters for PC games with no cover',
      'The museum no longer opens on a black screen with a big library',
      'Android: PC games through GameNative or DroidDeck, and Pause / Cancel for box art downloads',
      'Retro TV: live progress for the commercial search and ad downloads'
    ],
    platforms: [
      'Windows and Linux: everything above but the Android parts.',
      'Android (AYN Thor): the PC console, box art Pause / Cancel, the museum and Retro TV fixes.'
    ],
    sections: [
      { h: 'Custom games and shelves', items: [
        ['A page for each custom game', 'Settings → Custom games → a game: its name, launch arguments (for example -dx12), its Platform and Remove. Details shows its program and arguments. By supalii, from their Boxshelf fork.'],
        ['Put a program on any shelf', 'Platform puts it on Custom, PC or a console\'s shelf, beside that console\'s games. (T)rustyShelf still starts the program itself, never through the emulator. By supalii.'],
        ['Xbox One shelf', 'A shelf for Xbox One ports and recompilations that run as PC programs: no emulator or games folder. It shows up once a program is put on it. By supalii.'],
        ['Automatic PC posters', 'With a SteamGridDB key and automatic box art on, PC games with no cover get a SteamGridDB poster. A cover you chose, the store\'s or Steam\'s always comes first. By supalii.'],
        ['Hide more tiles', 'Hide from shelf works on the Open emulator and Surprise me tiles too; Settings → Hidden games & tiles brings them back. By supalii.']
      ] },
      { h: 'Museum and Retro TV', items: [
        ['No more black museum', 'With a few hundred games on a console, the museum opened all black until you zoomed in. A wide wall is now framed around where you are, and it\'s never lost in the room\'s haze.'],
        ['Look around', 'The right stick, a mouse drag or , and . look left and right along the wall; the side displays can be picked from the wide view. By TrapEmAll.'],
        ['Retro TV progress', 'The TV guide shows the commercial search as it goes (42 of 300, 6 found), and the TV says how far an ad\'s download is. By TrapEmAll.']
      ] },
      { h: 'Android', items: [
        ['PC games', 'A PC console: GameNative\'s Frontend sync files are its games, started in GameNative (every store) or DroidDeck (Steam), or any other app you pick.'],
        ['Pause or cancel box art', 'While box art downloads, the quick menu\'s Box art download row has Pause, Resume and Cancel, as on Windows. (On Windows and Linux, the art card\'s Resume button now resumes instead of pausing again.)'],
        ['ARMSX2', 'ARMSX2\'s GitHub, nightly and debug builds are found by their ids too.']
      ] }
    ]
  },
  {
    version: '1.82.0-beta.9', android: '1.82.0-beta.9', date: '2026-11-06', title: 'Smoother, better manuals, and covers for every custom game',
    highlights: [
      'Smoother: background work no longer makes the shelf hitch, and the Art Studio opens faster',
      'Manuals: the right manual for the right game, scan collections for 26 consoles, cleaner pages',
      'Connect your accounts during setup, with Paste buttons (right-click Paste works too)',
      'Covers for all your custom games at once: recomps, ports and programs you added',
      'Thor: video previews, ports and custom APKs, six more consoles; Steam Deck: hold Select + Start to close a game'
    ],
    platforms: [
      'Windows: everything above but the Thor parts.',
      'Android (AYN Thor): video previews in Details, ports and custom APKs, six more consoles.',
      'Linux / Steam Deck (experimental): hold Select + Start to close a game; covers for every custom game.'
    ],
    sections: [
      { h: 'New', items: [
        ['Covers for every custom game', 'Settings → Custom games → Covers: go through every recomp, port and program without a cover (SteamGridDB\'s covers for each, A uses one, Skip moves on), or let (T)rustyShelf pick the best match for each in one go, with Undo. Needs a free SteamGridDB key.'],
        ['Thor: video previews', 'Videos beside your games (a "videos", "media/videos" or "snap" folder in a console\'s games folder) play behind the case in Details, and YouTube trailers in the Media tab. Off until you switch them on: Settings → Shelf & museum → Video previews.'],
        ['Thor: ports and custom APKs', 'Settings → Games → Ports & custom APKs: switch on the apps that are games (ports, recomps, a custom APK) and they get a Custom shelf of their own, off the Apps shelf.'],
        ['Thor: six more consoles', 'Sega CD, 32X, Atari 2600, Lynx, WonderSwan and DOS, through RetroArch (MD.emu for Sega CD too), with their box art, manuals and achievements.'],
        ['Steam Deck: leave any game', 'Hold Select + Start for a moment during a game and (T)rustyShelf closes it, whatever the emulator.'],
        ['Accounts in setup', 'The first-run setup has an optional Accounts page: RetroAchievements, SteamGridDB, ScreenScraper and fanart.tv, each with a link to its free key, a Paste button and a Test. With a controller, an on-screen keyboard. Skip it and nothing changes.'],
        ['Manuals for many more consoles', 'Scan collections for PlayStation, NES, SNES, N64, Game Boy, DS, 3DS, Sega, Atari, TurboGrafx-16 and Neo Geo games, plus Nintendo\'s high-resolution manuals for Wii, GameCube, N64, DS and 3DS.']
      ] },
      { h: 'Better', items: [
        ['Smoother everywhere', 'Box art, manual and library work in the background takes turns with the shelf instead of freezing it, games folders are read once instead of over and over, and coming back from a game no longer sets off a full rescan.'],
        ['The right manual for the right game', 'Stricter matching: no more sequels\' or other consoles\' manuals, no promotional flyers. Manuals picked before that don\'t match are set aside (kept in the backup folder) and looked up again. Games with no manual anywhere say "no manual found online".'],
        ['Cleaner manual pages', 'No more thumbnail "pages", huge scans made a sensible size, and digital manuals and box wraps are no longer cut in half.'],
        ['Fix a manual', 'In the manual reader, Fix manual (Y / W) offers Wrong game (set it aside and get the right one, from the scan collections first) or Repair (the same manual with its cover, pages and sizes put right). Right away, for that game only.'],
        ['Art Studio shows the whole box', 'The case in the Art Studio takes the shape of the game\'s box, so 3DS, PSP, Switch, Blu-ray and cartridge boxes show whole instead of cropped.'],
        ['Wii U manuals open on the box', 'Manuals made from a Wii U game\'s own e-manual open on the box front again, wherever (T)rustyShelf runs from.'],
        ['Right-click Paste', 'Text boxes have the usual Cut / Copy / Paste menu.'],
        ['Settings opens the right page', 'Links to a page of its own (from a card or the bottom screen) now land on that page, on every platform.']
      ] }
    ]
  },
  {
    version: '1.82.0-beta.8', android: '1.82.0-beta.8', date: '2026-11-06', title: 'Video previews, a new Details page and easier setup',
    highlights: [
      'Video previews: rest on a game and its trailer plays, on the shelf and in Details, console games too',
      'A new Details page: the game\'s logo, play stats, tabs and one big Play button',
      'Add many games at once: pick several, scan a folder, or import from Playnite (experimental)',
      'Ten more consoles, including Saturn, Neo Geo, Arcade and DOS',
      'Set up for me: one switch sets up RetroArch, Dolphin, DuckStation, PCSX2 and PPSSPP'
    ],
    // (scripts/release-notes.js prints these under the notes: where each part works)
    platforms: [
      'Windows: everything above.',
      'Linux / Steam Deck (experimental): everything except Set up for me, console trailers, scanning a folder of games and the Playnite import. On a Steam Deck, add (T)rustyShelf to Steam (it offers to) and play from Game Mode.',
      'Android (AYN Thor): the new Details page and the magazines fix; video previews, Add games and the new consoles come to Android later.'
    ],
    sections: [
      { h: 'New', items: [
        ['Video previews', 'Rest on a game and its preview plays, softly behind the shelf and behind the case in Details: your own videos (ES-DE, EmuDeck, RetroBat, LaunchBox or a folder of your own), Steam\'s own trailers for Steam games, and console trailers from YouTube. Settings → Video previews, which also sets how soon they start (half a second to 15 seconds).'],
        ['Console trailers', 'A console game\'s YouTube trailer is kept as a short clip (about 1 MB) the first time you rest on it, so it plays on the shelf just like a Steam trailer. It needs a free helper (yt-dlp), fetched once with one press: (T)rustyShelf asks you on the shelf, or Settings → Video previews.'],
        ['A new Details page', 'The game\'s logo, time played and last played, one Play button with Manual, Inspect and More beside it, and tabs: Overview, Media and Your copy (LB / RB, or Q / E). The game\'s art or its preview fills the background.'],
        ['Add many games at once', 'Settings → Custom games → Add games, or the Add games tile at the end of the Custom shelf: pick several programs at once, or point (T)rustyShelf at a folder of games and tick the ones to add.'],
        ['Import from Playnite (experimental)', 'Bring your Playnite library over in one go: games you added by hand, with their covers, and your emulated games\' folders. You see what will be added first, and one press removes it all again. Tell us how it goes.'],
        ['Steam Deck: Game Mode and Add to Steam', '(T)rustyShelf now starts from Steam and in Game Mode by itself. On a Steam Deck in Desktop Mode it offers to add itself to Steam, so your controller works as a gamepad in games (outside Steam, B is the Esc key, which quits most emulators). Any time: Settings → System → Add (T)rustyShelf to Steam.'],
        ['Switch: Citron and Ryujinx', 'Found and started as well as Eden, so EmuDeck\'s Switch emulator works without setting anything up.'],
        ['Ten more consoles', 'Saturn, TurboGrafx-16, Neo Geo, Arcade, Sega CD, 32X, Atari 2600, Lynx, WonderSwan and DOS, through RetroArch, each with its own case and colours. Arcade games show their real names.'],
        ['Set up for me', 'Settings → a console → Set up for me: your controller mapped, the Home menu\'s Save and Load keys, one shared BIOS folder and graphics that suit your PC. Your files are backed up first, and Undo puts them back. The first run can do it for you.'],
        ['RetroArch cores and BIOS files', 'A missing RetroArch core downloads by itself the first time you play, and Settings checks the BIOS files each console needs.'],
        ['More PC stores', 'GOG, Ubisoft Connect, EA app and Xbox / Game Pass games join Steam and Epic on the PC shelf.'],
        ['Library tools', 'Filter by decade, genre, players or co-op, and make collections: shelves of your own, from Details → More → Collections.'],
        ['Patch notes in the app', 'A card on the shelf when a new version is out, with its highlights; What\'s new after you update; and every version\'s notes in Settings → System → What\'s new.']
      ] },
      { h: 'Better', items: [
        ['A tidier first run', 'Only the consoles you have games for come ticked; the rest fold away, grouped by maker.'],
        ['Easier to find', 'Video previews has its own place in Settings, and Add games its own page, so the main pages stay short.']
      ] },
      { h: 'Fixed', items: [
        ['Trailers play again', 'YouTube stopped playing trailers opened on their own. They now play in TrustyShelf\'s own player.'],
        ['Android: magazines and guides always show', 'The reading corner\'s list could stay empty on some devices; it now always loads.'],
        ['Your changes stay put', 'A game you renamed, or a finished "Set up for me", could be undone by changing another setting in the same visit.'],
        ['No accidental holds', 'Holding A on a disc, or holding Restart / Shut down, now stops if you switch away or pull down the notification shade, instead of finishing on its own.'],
        ['Covers and the museum', 'A Wi-Fi sign-in page could be saved as a game\'s cover, and the museum\'s camera jumped when you touched the controls after leaving it idle.'],
        ['Android: taps after a quick swipe', 'After flicking the shelf or the console bar, the first tap on a game or console did nothing. It works first time now.']
      ] }
    ]
  },  {
    version: '1.82.0-beta.6', android: '0.4.0-beta.1', date: '2026-11-05', title: 'Now on Android and Linux, and clean game transitions',
    highlights: [
      '(T)rustyShelf on Android (AYN Thor) and Linux / Steam Deck',
      'Starting and quitting a game shows nothing but the game',
      'Twelve retro consoles, from PlayStation to Dreamcast'
    ],
    sections: [
      { h: 'New', items: [
        ['Android and Linux', 'The AYN Thor gets (T)rustyShelf with its bottom screen; Linux and the Steam Deck get an AppImage (experimental).'],
        ['Retro consoles', 'PlayStation, NES, SNES, Nintendo 64, Game Boy, Game Boy Color, Game Boy Advance, DS, Mega Drive, Master System, Game Gear and Dreamcast.'],
        ['Rename and change covers', 'Give any game the name you want, and pick its cover from every one found.']
      ] },
      { h: 'Better', items: [
        ['Clean game transitions', 'No taskbar, no desktop and no gaps while a game starts or closes: it feels like a console.']
      ] }
    ]
  }
];
