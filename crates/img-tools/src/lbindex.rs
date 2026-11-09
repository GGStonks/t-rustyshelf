use std::cell::Cell;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::time::{SystemTime, UNIX_EPOCH};

use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use unicode_normalization::UnicodeNormalization;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Game {
    pub id: String,
    pub name: String,
    pub n: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dev: Option<String>,
    #[serde(rename = "pub", skip_serializing_if = "Option::is_none")]
    pub pub_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genres: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub esrb: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub players: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coop: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wiki: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct GameImage {
    #[serde(rename = "type")]
    pub r#type: String,
    pub region: String,
    pub file: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LaunchboxIndex {
    pub v: u32,
    pub at: u64,
    pub games: HashMap<String, Vec<Game>>,
    pub images: HashMap<String, Vec<GameImage>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ShardFile {
    pub v: u32,
    pub plat: String,
    pub games: Vec<Game>,
    pub images: HashMap<String, Vec<GameImage>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ShardsMeta {
    pub v: u32,
    pub at: u64,
    pub plats: Vec<String>,
    pub stamp: u64,
}

pub fn norm(s: &str) -> String {
    // 1. Lowercase + NFD decompose, strip combining diacritical marks [\u0300-\u036f]
    let decomposed: String = s
        .to_lowercase()
        .nfd()
        .filter(|&c| !(c >= '\u{0300}' && c <= '\u{036f}'))
        .collect();

    // 2. Replace '&' with " and ", strip '\'' and '’' (\u{2019})
    let mut step2 = String::with_capacity(decomposed.len() + 10);
    for c in decomposed.chars() {
        if c == '&' {
            step2.push_str(" and ");
        } else if c != '\'' && c != '\u{2019}' {
            step2.push(c);
        }
    }

    // 3. Replace [^a-z0-9]+ with ' '
    let mut step3 = String::with_capacity(step2.len());
    let mut in_sep = false;
    for c in step2.chars() {
        if c.is_ascii_alphanumeric() {
            step3.push(c);
            in_sep = false;
        } else if !in_sep {
            step3.push(' ');
            in_sep = true;
        }
    }

    // 4. Split into words, filter \b(the|a|an)\b, convert Roman numerals, and join with ' '
    let mut words = Vec::new();
    for word in step3.split_whitespace() {
        if word == "the" || word == "a" || word == "an" {
            continue;
        }
        let mapped = match word {
            "xviii" => "18",
            "xvii" => "17",
            "xiii" => "13",
            "viii" => "8",
            "xvi" => "16",
            "xiv" => "14",
            "xii" => "12",
            "vii" => "7",
            "iii" => "3",
            "xix" => "19",
            "xv" => "15",
            "xi" => "11",
            "xx" => "20",
            "ix" => "9",
            "vi" => "6",
            "iv" => "4",
            "ii" => "2",
            "v" => "5",
            other => other,
        };
        words.push(mapped);
    }

    words.join(" ")
}

pub fn unescape_xml(s: &str) -> String {
    let text = if s.starts_with("<![CDATA[") && s.ends_with("]]>") {
        &s[9..s.len() - 3]
    } else {
        s
    };
    if !text.contains('&') {
        return text.trim().to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(idx) = rest.find('&') {
        out.push_str(&rest[..idx]);
        let tail = &rest[idx..];
        if tail.starts_with("&amp;") {
            out.push('&');
            rest = &tail[5..];
        } else if tail.starts_with("&lt;") {
            out.push('<');
            rest = &tail[4..];
        } else if tail.starts_with("&gt;") {
            out.push('>');
            rest = &tail[4..];
        } else if tail.starts_with("&quot;") {
            out.push('"');
            rest = &tail[6..];
        } else if tail.starts_with("&apos;") {
            out.push('\'');
            rest = &tail[6..];
        } else {
            out.push('&');
            rest = &tail[1..];
        }
    }
    out.push_str(rest);
    out.trim().to_string()
}

pub fn is_accepted_image_type(t: &str) -> bool {
    matches!(
        t,
        "Box - Front"
            | "Box - Front - Reconstructed"
            | "Box - Back"
            | "Box - Back - Reconstructed"
            | "Box - Spine"
            | "Box - Full"
            | "Disc"
            | "Cart - Front"
            | "Fanart - Box - Front"
            | "Fanart - Box - Back"
            | "Fanart - Cart - Front"
            | "Fanart - Disc"
            | "Fanart - Background"
            | "Steam Poster"
            | "Screenshot - Gameplay"
            | "Screenshot - Game Title"
            | "Screenshot - Game Select"
            | "Clear Logo"
    )
}

pub fn shard_file_name<P: AsRef<Path>>(dir: P, plat: &str) -> PathBuf {
    let mut clean = String::with_capacity(plat.len() + 16);
    clean.push_str("launchbox-");
    let mut in_underscore = false;
    for c in plat.chars() {
        if c.is_ascii_alphanumeric() {
            clean.push(c);
            in_underscore = false;
        } else if !in_underscore {
            clean.push('_');
            in_underscore = true;
        }
    }
    clean.push_str(".json");
    dir.as_ref().join(clean)
}

#[derive(Clone)]
pub struct ProgressCounter(Rc<Cell<u64>>);

impl ProgressCounter {
    pub fn new() -> Self {
        Self(Rc::new(Cell::new(0)))
    }
    pub fn get(&self) -> u64 {
        self.0.get()
    }
    pub fn add(&self, n: u64) {
        self.0.set(self.0.get() + n);
    }
}

pub struct CountingReader<R> {
    inner: R,
    counter: ProgressCounter,
}

impl<R: Read> CountingReader<R> {
    pub fn new(inner: R, counter: ProgressCounter) -> Self {
        Self { inner, counter }
    }
}

impl<R: Read> Read for CountingReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.counter.add(n as u64);
        Ok(n)
    }
}

fn read_tag_text<R: BufRead>(reader: &mut Reader<R>, end_name: &str) -> String {
    let mut text_buf = Vec::new();
    match reader.read_text_into(quick_xml::name::QName(end_name), &mut text_buf) {
        Ok(text) => unescape_xml(&text),
        Err(_) => String::new(),
    }
}

pub fn parse_launchbox_xml<R: BufRead, F: FnMut(u32)>(
    mut reader: Reader<R>,
    total_size: u64,
    counter: Option<ProgressCounter>,
    platforms: &[String],
    version: u32,
    mut on_pct: F,
) -> Result<LaunchboxIndex, Box<dyn std::error::Error>> {
    reader.config_mut().allow_dangling_amp = true;
    reader.config_mut().check_end_names = false;
    reader.config_mut().allow_unmatched_ends = true;
    reader.config_mut().trim_text(false);

    let platform_set: HashSet<&str> = platforms.iter().map(|s| s.as_str()).collect();
    let mut games: HashMap<String, Vec<Game>> = HashMap::new();
    for p in platforms {
        games.insert(p.clone(), Vec::new());
    }

    let mut ids: HashSet<String> = HashSet::new();
    let mut images: HashMap<String, Vec<GameImage>> = HashMap::new();

    let mut buf = Vec::new();
    let mut skip_buf = Vec::new();
    let mut last_pct: i32 = -1;

    let check_progress = |last_pct: &mut i32, on_pct: &mut F| {
        if let Some(ref c) = counter {
            if total_size > 0 {
                let pct = ((c.get() as f64 / total_size as f64) * 100.0).floor() as i32;
                let pct = pct.clamp(0, 100);
                if pct != *last_pct {
                    *last_pct = pct;
                    on_pct(pct as u32);
                }
            }
        }
    };

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = e.name().into_inner();
                if name == "Game" {
                    let mut plat = String::new();
                    let mut id = String::new();
                    let mut gname = String::new();
                    let mut overview = String::new();
                    let mut release = String::new();
                    let mut year = String::new();
                    let mut dev = String::new();
                    let mut pub_ = String::new();
                    let mut genres = String::new();
                    let mut esrb = String::new();
                    let mut players = String::new();
                    let mut coop = String::new();
                    let mut rating = String::new();
                    let mut wiki = String::new();
                    let mut video = String::new();

                    let mut inner_buf = Vec::new();
                    loop {
                        match reader.read_event_into(&mut inner_buf) {
                            Ok(Event::Start(ref child)) => {
                                let cname = child.name().into_inner();
                                match cname {
                                    "Platform" => plat = read_tag_text(&mut reader, "Platform"),
                                    "DatabaseID" => id = read_tag_text(&mut reader, "DatabaseID"),
                                    "Name" => gname = read_tag_text(&mut reader, "Name"),
                                    "Overview" => overview = read_tag_text(&mut reader, "Overview"),
                                    "ReleaseDate" => release = read_tag_text(&mut reader, "ReleaseDate"),
                                    "ReleaseYear" => year = read_tag_text(&mut reader, "ReleaseYear"),
                                    "Developer" => dev = read_tag_text(&mut reader, "Developer"),
                                    "Publisher" => pub_ = read_tag_text(&mut reader, "Publisher"),
                                    "Genres" => genres = read_tag_text(&mut reader, "Genres"),
                                    "ESRB" => esrb = read_tag_text(&mut reader, "ESRB"),
                                    "MaxPlayers" => players = read_tag_text(&mut reader, "MaxPlayers"),
                                    "Cooperative" => coop = read_tag_text(&mut reader, "Cooperative"),
                                    "CommunityRating" => rating = read_tag_text(&mut reader, "CommunityRating"),
                                    "WikipediaURL" => wiki = read_tag_text(&mut reader, "WikipediaURL"),
                                    "VideoURL" => video = read_tag_text(&mut reader, "VideoURL"),
                                    _ => {
                                        let _ = reader.read_to_end_into(child.to_end().name(), &mut skip_buf);
                                    }
                                }
                            }
                            Ok(Event::End(ref end_e)) if end_e.name().into_inner() == "Game" => {
                                break;
                            }
                            Ok(Event::Eof) => break,
                            _ => {}
                        }
                        inner_buf.clear();
                    }

                    if platform_set.contains(plat.as_str()) && !id.is_empty() && !gname.is_empty() {
                        ids.insert(id.clone());
                        let n = norm(&gname);
                        let ov = if !overview.is_empty() {
                            let collapsed = overview.split_whitespace().collect::<Vec<_>>().join(" ");
                            if !collapsed.is_empty() {
                                let truncated: String = collapsed.chars().take(2500).collect();
                                Some(truncated)
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                        let game = Game {
                            id,
                            name: gname,
                            n,
                            overview: ov,
                            release: if !release.is_empty() { Some(release) } else { None },
                            year: if !year.is_empty() { Some(year) } else { None },
                            dev: if !dev.is_empty() { Some(dev) } else { None },
                            pub_: if !pub_.is_empty() { Some(pub_) } else { None },
                            genres: if !genres.is_empty() { Some(genres) } else { None },
                            esrb: if !esrb.is_empty() { Some(esrb) } else { None },
                            players: if !players.is_empty() { Some(players) } else { None },
                            coop: if !coop.is_empty() { Some(coop) } else { None },
                            rating: if !rating.is_empty() { Some(rating) } else { None },
                            wiki: if !wiki.is_empty() { Some(wiki) } else { None },
                            video: if !video.is_empty() { Some(video) } else { None },
                        };

                        games.entry(plat).or_default().push(game);
                    }
                    check_progress(&mut last_pct, &mut on_pct);
                } else if name == "GameImage" {
                    let mut id = String::new();
                    let mut img_type = String::new();
                    let mut region = String::new();
                    let mut file = String::new();

                    let mut inner_buf = Vec::new();
                    loop {
                        match reader.read_event_into(&mut inner_buf) {
                            Ok(Event::Start(ref child)) => {
                                let cname = child.name().into_inner();
                                match cname {
                                    "DatabaseID" => id = read_tag_text(&mut reader, "DatabaseID"),
                                    "Type" => img_type = read_tag_text(&mut reader, "Type"),
                                    "Region" => region = read_tag_text(&mut reader, "Region"),
                                    "FileName" => file = read_tag_text(&mut reader, "FileName"),
                                    _ => {
                                        let _ = reader.read_to_end_into(child.to_end().name(), &mut skip_buf);
                                    }
                                }
                            }
                            Ok(Event::End(ref end_e)) if end_e.name().into_inner() == "GameImage" => {
                                break;
                            }
                            Ok(Event::Eof) => break,
                            _ => {}
                        }
                        inner_buf.clear();
                    }

                    if ids.contains(&id) && is_accepted_image_type(&img_type) {
                        let list = images.entry(id).or_default();
                        let limit = if img_type == "Fanart - Background" {
                            Some(2)
                        } else if img_type == "Clear Logo" {
                            Some(1)
                        } else if img_type.starts_with("Screenshot") {
                            Some(6)
                        } else {
                            None
                        };

                        let allowed = match limit {
                            Some(max) => list.iter().filter(|x| x.r#type == img_type).count() < max,
                            None => true,
                        };

                        if allowed {
                            list.push(GameImage {
                                r#type: img_type,
                                region,
                                file,
                            });
                        }
                    }
                    check_progress(&mut last_pct, &mut on_pct);
                } else if name != "LaunchBox" && name != "xml" {
                    let _ = reader.read_to_end_into(e.to_end().name(), &mut skip_buf);
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                eprintln!("XML parsing warning: {}", e);
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    Ok(LaunchboxIndex {
        v: version,
        at,
        games,
        images,
    })
}

pub fn write_shards(
    idx: &LaunchboxIndex,
    dir: &Path,
    stamp: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    std::fs::create_dir_all(dir)?;
    let mut plats: Vec<String> = Vec::new();

    for (plat, list) in &idx.games {
        plats.push(plat.clone());
        let mut shard_images: HashMap<String, Vec<GameImage>> = HashMap::new();
        for g in list {
            if let Some(imgs) = idx.images.get(&g.id) {
                shard_images.insert(g.id.clone(), imgs.clone());
            }
        }

        let shard = ShardFile {
            v: idx.v,
            plat: plat.clone(),
            games: list.clone(),
            images: shard_images,
        };

        let f = shard_file_name(dir, plat);
        let f_tmp = f.with_extension("json.tmp");
        {
            let file = File::create(&f_tmp)?;
            let writer = std::io::BufWriter::with_capacity(512 * 1024, file);
            serde_json::to_writer(writer, &shard)?;
        }
        std::fs::rename(&f_tmp, &f)?;
    }

    let meta = ShardsMeta {
        v: idx.v,
        at: idx.at,
        plats,
        stamp,
    };
    let meta_f = dir.join("launchbox-shards.json");
    let meta_tmp = dir.join("launchbox-shards.json.tmp");
    {
        let file = File::create(&meta_tmp)?;
        let writer = std::io::BufWriter::with_capacity(64 * 1024, file);
        serde_json::to_writer(writer, &meta)?;
    }
    std::fs::rename(&meta_tmp, &meta_f)?;

    Ok(())
}

pub fn build_index_file(
    xml_path: &Path,
    idx_path: &Path,
    platforms: &[String],
    version: u32,
    shards_dir: Option<&Path>,
    mut on_pct: impl FnMut(u32),
) -> Result<String, Box<dyn std::error::Error>> {
    let file = File::open(xml_path)?;
    let total_size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let counter = ProgressCounter::new();
    let counting_reader = CountingReader::new(file, counter.clone());
    let buf_reader = BufReader::with_capacity(1024 * 1024, counting_reader);
    let reader = Reader::from_reader(buf_reader);

    let idx = parse_launchbox_xml(reader, total_size, Some(counter), platforms, version, &mut on_pct)?;

    if let Some(parent) = idx_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let temp_idx = format!("{}.tmp", idx_path.display());
    {
        let f = File::create(&temp_idx)?;
        let writer = std::io::BufWriter::with_capacity(1024 * 1024, f);
        serde_json::to_writer(writer, &idx)?;
    }
    std::fs::rename(&temp_idx, idx_path)?;

    // Compute counts string matching JS format: "Platform=Count, Platform=Count"
    let counts = platforms
        .iter()
        .map(|plat| {
            let count = idx.games.get(plat).map(|v| v.len()).unwrap_or(0);
            format!("{}={}", plat, count)
        })
        .collect::<Vec<_>>()
        .join(", ");

    if let Some(s_dir) = shards_dir {
        let stamp = std::fs::metadata(idx_path)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::now())
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        write_shards(&idx, s_dir, stamp)?;
    }

    Ok(counts)
}

pub fn split_index_file(idx_path: &Path, dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let stamp = std::fs::metadata(idx_path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::now())
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let f = File::open(idx_path)?;
    let reader = BufReader::with_capacity(1024 * 1024, f);
    let idx: LaunchboxIndex = serde_json::from_reader(reader)?;

    write_shards(&idx, dir, stamp)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_norm_rules() {
        assert_eq!(norm("Dragon Ball Z: Budokai Tenkaichi 3"), "dragon ball z budokai tenkaichi 3");
        assert_eq!(norm("Pokémon: Let's Go, Pikachu!"), "pokemon lets go pikachu");
        assert_eq!(norm("Pokémon: Let’s Go, Pikachu!"), "pokemon lets go pikachu");
        assert_eq!(norm("Mega Man X"), "mega man x");
        assert_eq!(norm("Final Fantasy VII"), "final fantasy 7");
        assert_eq!(norm("The Legend of Zelda: A Link to the Past"), "legend of zelda link to past");
        assert_eq!(norm("Grand Theft Auto IV"), "grand theft auto 4");
        assert_eq!(norm("Super Mario World: Super Mario Advance 2"), "super mario world super mario advance 2");
        assert_eq!(norm("Rock & Roll Racing"), "rock and roll racing");
        assert_eq!(norm("Star Wars: Episode I - Racer"), "star wars episode i racer");
        assert_eq!(norm("Street Fighter Alpha 3: Saikyō Dōjō"), "street fighter alpha 3 saikyo dojo");
        assert_eq!(norm("The"), "");
        assert_eq!(norm(""), "");
    }

    #[test]
    fn test_unescape_xml() {
        assert_eq!(unescape_xml("Test &amp; &lt;Game&gt; &quot;Name&apos;"), "Test & <Game> \"Name'");
        assert_eq!(unescape_xml("Rock & Roll"), "Rock & Roll");
        assert_eq!(unescape_xml("<![CDATA[Some <cdata> & overview]]>"), "Some <cdata> & overview");
        assert_eq!(unescape_xml("   Padded text   "), "Padded text");
    }

    #[test]
    fn test_shard_file_name() {
        let dir = Path::new("/cache");
        assert_eq!(shard_file_name(dir, "Nintendo Switch"), PathBuf::from("/cache/launchbox-Nintendo_Switch.json"));
        assert_eq!(shard_file_name(dir, "Sony Playstation 5"), PathBuf::from("/cache/launchbox-Sony_Playstation_5.json"));
        assert_eq!(shard_file_name(dir, "Microsoft Xbox Series X/S"), PathBuf::from("/cache/launchbox-Microsoft_Xbox_Series_X_S.json"));
    }

    #[test]
    fn test_parse_launchbox_xml_full() {
        let xml = r#"<?xml version="1.0" standalone="yes"?>
<LaunchBox>
  <Game>
    <Platform>Nintendo Switch</Platform>
    <DatabaseID>1001</DatabaseID>
    <Name>Super Mario Odyssey</Name>
    <Overview>A 3D platformer game featuring Mario &amp; Cappy.</Overview>
    <ReleaseDate>2017-10-27</ReleaseDate>
    <ReleaseYear>2017</ReleaseYear>
    <Developer>Nintendo</Developer>
    <Publisher>Nintendo</Publisher>
    <Genres>Platform</Genres>
    <ESRB>Everyone 10+</ESRB>
    <MaxPlayers>2</MaxPlayers>
    <Cooperative>true</Cooperative>
    <CommunityRating>4.8</CommunityRating>
    <UnknownIgnoredTag>Some Value</UnknownIgnoredTag>
  </Game>
  <Game>
    <Platform>Sony Playstation 5</Platform>
    <DatabaseID>1002</DatabaseID>
    <Name>Demon's Souls</Name>
  </Game>
  <Game>
    <Platform>Unwanted Platform</Platform>
    <DatabaseID>9999</DatabaseID>
    <Name>Unwanted Game</Name>
  </Game>
  <Game>
    <Platform>Nintendo Switch</Platform>
    <DatabaseID></DatabaseID>
    <Name>Missing ID</Name>
  </Game>
  <Game>
    <Platform>Nintendo Switch</Platform>
    <DatabaseID>1003</DatabaseID>
    <Name></Name>
  </Game>
  <!-- Images -->
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Box - Front</Type>
    <Region>North America</Region>
    <FileName>mario_front.jpg</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Clear Logo</Type>
    <Region></Region>
    <FileName>mario_logo1.png</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Clear Logo</Type>
    <Region></Region>
    <FileName>mario_logo2.png</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Fanart - Background</Type>
    <Region></Region>
    <FileName>bg1.jpg</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Fanart - Background</Type>
    <Region></Region>
    <FileName>bg2.jpg</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Fanart - Background</Type>
    <Region></Region>
    <FileName>bg3.jpg</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>1001</DatabaseID>
    <Type>Unaccepted Type</Type>
    <Region></Region>
    <FileName>ignored.jpg</FileName>
  </GameImage>
  <GameImage>
    <DatabaseID>9999</DatabaseID>
    <Type>Box - Front</Type>
    <Region></Region>
    <FileName>unwanted_front.jpg</FileName>
  </GameImage>
</LaunchBox>
"#;
        let platforms = vec!["Nintendo Switch".to_string(), "Sony Playstation 5".to_string()];
        let reader = Reader::from_str(xml);
        let mut pcts = Vec::new();
        let idx = parse_launchbox_xml(reader, xml.len() as u64, None, &platforms, 8, |p| pcts.push(p)).unwrap();

        assert_eq!(idx.v, 8);
        assert_eq!(idx.games.get("Nintendo Switch").unwrap().len(), 1);
        let g1 = &idx.games.get("Nintendo Switch").unwrap()[0];
        assert_eq!(g1.id, "1001");
        assert_eq!(g1.name, "Super Mario Odyssey");
        assert_eq!(g1.n, "super mario odyssey");
        assert_eq!(g1.overview.as_deref(), Some("A 3D platformer game featuring Mario & Cappy."));
        assert_eq!(g1.dev.as_deref(), Some("Nintendo"));
        assert_eq!(g1.year.as_deref(), Some("2017"));

        assert_eq!(idx.games.get("Sony Playstation 5").unwrap().len(), 1);
        let g2 = &idx.games.get("Sony Playstation 5").unwrap()[0];
        assert_eq!(g2.id, "1002");
        assert_eq!(g2.name, "Demon's Souls");
        assert_eq!(g2.n, "demons souls");
        assert_eq!(g2.overview, None);

        // Images for 1001:
        // - Box - Front (1)
        // - Clear Logo: only 1 kept
        // - Fanart - Background: only 2 kept
        // - Unaccepted Type: ignored
        let imgs = idx.images.get("1001").unwrap();
        assert_eq!(imgs.len(), 4);
        assert_eq!(imgs.iter().filter(|x| x.r#type == "Clear Logo").count(), 1);
        assert_eq!(imgs.iter().filter(|x| x.r#type == "Fanart - Background").count(), 2);
        assert_eq!(imgs.iter().filter(|x| x.r#type == "Box - Front").count(), 1);

        // Images for 9999 should not exist
        assert!(idx.images.get("9999").is_none());
    }

    #[test]
    fn test_sharding_roundtrip() {
        let temp_dir = std::env::temp_dir().join(format!("trustyshelf_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).unwrap();

        let mut games = HashMap::new();
        games.insert("Nintendo Switch".to_string(), vec![Game {
            id: "1".to_string(),
            name: "Zelda".to_string(),
            n: "zelda".to_string(),
            overview: None,
            release: None,
            year: None,
            dev: None,
            pub_: None,
            genres: None,
            esrb: None,
            players: None,
            coop: None,
            rating: None,
            wiki: None,
            video: None,
        }]);

        let mut images = HashMap::new();
        images.insert("1".to_string(), vec![GameImage {
            r#type: "Box - Front".to_string(),
            region: "NA".to_string(),
            file: "zelda.jpg".to_string(),
        }]);

        let idx = LaunchboxIndex {
            v: 8,
            at: 12345678,
            games,
            images,
        };

        write_shards(&idx, &temp_dir, 999999).unwrap();

        let shard_path = shard_file_name(&temp_dir, "Nintendo Switch");
        assert!(shard_path.exists());
        let shard_content = std::fs::read_to_string(&shard_path).unwrap();
        let parsed_shard: ShardFile = serde_json::from_str(&shard_content).unwrap();
        assert_eq!(parsed_shard.plat, "Nintendo Switch");
        assert_eq!(parsed_shard.games.len(), 1);
        assert_eq!(parsed_shard.images.get("1").unwrap().len(), 1);

        let meta_path = temp_dir.join("launchbox-shards.json");
        assert!(meta_path.exists());
        let meta_content = std::fs::read_to_string(&meta_path).unwrap();
        let parsed_meta: ShardsMeta = serde_json::from_str(&meta_content).unwrap();
        assert_eq!(parsed_meta.stamp, 999999);
        assert_eq!(parsed_meta.plats, vec!["Nintendo Switch".to_string()]);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
