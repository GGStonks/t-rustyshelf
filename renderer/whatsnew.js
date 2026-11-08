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
