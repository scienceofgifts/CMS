# frozen_string_literal: true
require "fileutils"

assets_dir = File.expand_path("../assets", __dir__)
FileUtils.mkdir_p(assets_dir)

images = [
  # --- HOMEPAGE & HEROES ---
  {
    name: "home-hero",
    gradient_type: :diagonal_down,
    badge: "THE INDEPENDENT GIFT PUBLICATION",
    title: "Science of Gifts",
    subtitle: "Still Life No. 14: Objects of Enduring Provenance"
  },
  {
    name: "hero_editorial_gifts",
    gradient_type: :radial_corner,
    badge: "EDITORIAL ARCHIVE",
    title: "Archival Still Life",
    subtitle: "Instruments, bindings, and curated curiosities"
  },

  # --- GUIDES ---
  {
    name: "history-gifts",
    gradient_type: :diagonal_down,
    badge: "ARCHIVAL CURATION   HISTORY",
    title: "The Best Gifts for History Buffs",
    subtitle: "Cartographic reproductions, archival instruments & translated source texts"
  },
  {
    name: "book-lovers-gifts",
    gradient_type: :diagonal_up,
    badge: "LITERARY ARTIFACTS   READING",
    title: "Gifts for Book Lovers",
    subtitle: "Solid brass desk anchors, optical lights & personal library embossers"
  },
  {
    name: "people-who-have-everything",
    gradient_type: :radial_center,
    badge: "CURATION & PROVENANCE",
    title: "Gifts for People Who Have Everything",
    subtitle: "Ephemeral single-harvest delicacies & impossible-to-find craft objects"
  },
  {
    name: "history-teachers",
    gradient_type: :horizontal,
    badge: "HISTORICAL PEDAGOGY",
    title: "Gifts for History Educators",
    subtitle: "Museum-grade classroom artifacts & facsimile primary sources"
  },
  {
    name: "astronomy-gifts",
    gradient_type: :vertical,
    badge: "CELESTIAL OBSERVATION",
    title: "Gifts for Amateur Astronomers",
    subtitle: "Precision planispheres, brass astrolabes & optical tools"
  },
  {
    name: "cartography-gifts",
    gradient_type: :diagonal_up,
    badge: "EXPLORATION & MAPS",
    title: "Gifts for Cartography Enthusiasts",
    subtitle: "Facsimile maritime charts, dividers & pocket compasses"
  },
  {
    name: "solitary-cook-gifts",
    gradient_type: :radial_corner,
    badge: "CULINARY ARTS",
    title: "Gifts for the Solitary Cook",
    subtitle: "Single-portion copper cookware, carbon steel knives & estate oils"
  },
  {
    name: "architect-gifts",
    gradient_type: :horizontal_reverse,
    badge: "DRAFTING & DESIGN",
    title: "Gifts for Architects & Designers",
    subtitle: "Solid brass layout gauges, leadholders & scale rulers"
  },

  # --- ARTICLES ---
  {
    name: "avoid-overthinking-gift-decisions",
    gradient_type: :diagonal_down,
    badge: "BEHAVIORAL PSYCHOLOGY",
    title: "Why We Overthink Giving Gifts",
    subtitle: "The Giver-Recipient Asymmetry & Longitudinal Utility"
  },
  {
    name: "physical-objects-vs-experiences",
    gradient_type: :radial_center,
    badge: "MATERIAL ANTHROPOLOGY",
    title: "Physical Objects vs Experiences",
    subtitle: "Why tactile objects act as anchors for human memory"
  },
  {
    name: "psychology-of-regifting",
    gradient_type: :diagonal_up,
    badge: "MATERIAL CULTURE",
    title: "The Psychology of Regifting",
    subtitle: "When passing curated objects along is the highest act of care"
  },

  # --- PRODUCTS IN MASTER CATALOG ---
  {
    name: "brass-book-weight",
    gradient_type: :diagonal_down,
    badge: "READER'S ESSENTIAL   $55",
    title: "Craighill Brass Page Anchor",
    subtitle: "Cast solid yellow brass 420g desk weight"
  },
  {
    name: "reading-lamp",
    gradient_type: :vertical_reverse,
    badge: "OPTICAL ACCESSORY   $26",
    title: "Glocusent Amber Reading Light",
    subtitle: "1800K warm candle glow non-glare illumination"
  },
  {
    name: "library-embosser",
    gradient_type: :horizontal,
    badge: "STATIONERY ARTIFACT   $38",
    title: "Custom Heavy Brass Library Embosser",
    subtitle: "Personalized ex-libris desk seal with clean tactile impression"
  },
  {
    name: "reading-stand",
    gradient_type: :radial_corner,
    badge: "DESK ACCESSORY   $78",
    title: "Solid Walnut Adjustable Book Stand",
    subtitle: "Hand-finished hardwood stand for folio editions & cookbooks"
  },
  {
    name: "antikythera-mechanism",
    gradient_type: :diagonal_up,
    badge: "HERITAGE REPLICA   $185",
    title: "Antikythera Gear Train Model",
    subtitle: "Museum-grade mechanical astronomy reconstruction"
  },
  {
    name: "atlas-book",
    gradient_type: :horizontal_reverse,
    badge: "CARTOGRAPHY   $65",
    title: "Atlas of Historical Maps (1600 1850)",
    subtitle: "Large format clothbound facsimile cartographic collection"
  },
  {
    name: "brass-loupe",
    gradient_type: :diagonal_down,
    badge: "OPTICAL TOOL   $44",
    title: "Solid Brass 10x Inspection Loupe",
    subtitle: "Achromatic optical glass doublet in weighted brass casing"
  },
  {
    name: "letters-envelope",
    gradient_type: :radial_center,
    badge: "PRIMARY SOURCES   $48",
    title: "Historic Letters & Ephemera Archive",
    subtitle: "Curated facsimile correspondence from major historical moments"
  },
  {
    name: "wax-seal-kit",
    gradient_type: :vertical,
    badge: "STATIONERY SET   $34",
    title: "Custom Brass Seal & Wax Set",
    subtitle: "Turned walnut handle with botanical sealing wax beads"
  },
  {
    name: "loeb-book",
    gradient_type: :diagonal_up,
    badge: "CLASSICAL TEXT   $32",
    title: "Herodotus: The Histories (Greek & English)",
    subtitle: "Clothbound dual-language edition with historical commentary"
  },
  {
    name: "vintage-map",
    gradient_type: :horizontal,
    badge: "MUSEUM PRINT   $42",
    title: "Archival Carta Marina Facsimile Print",
    subtitle: "100% cotton rag paper reproduction with mineral pigments"
  },
  {
    name: "brass-compass",
    gradient_type: :radial_corner,
    badge: "NAVIGATION   $58",
    title: "Solid Brass Pocket Sundial & Compass",
    subtitle: "Working magnetic needle with folding latitude gnomon"
  },
  {
    name: "folio-book",
    gradient_type: :diagonal_down,
    badge: "FINE BINDING   $75",
    title: "The Folio Society: Roman Republic",
    subtitle: "Buckram-bound illustrated edition in slipcase"
  },
  {
    name: "ancient-coin",
    gradient_type: :horizontal_reverse,
    badge: "NUMISMATICS   $95",
    title: "Authenticated Bronze Roman Denarius",
    subtitle: "Mounted in archival acrylic display case with provenance certificate"
  },
  {
    name: "ceramic-oil-bottle",
    gradient_type: :radial_center,
    badge: "ESTATE PROVENANCE   $42",
    title: "Handmade Ceramic Olive Oil Vessel",
    subtitle: "Single-estate cold pressed EVOO in reusable Puglia stoneware"
  },
  {
    name: "glass-prism",
    gradient_type: :diagonal_up,
    badge: "OPTICAL SCIENCE   $28",
    title: "Optical Crown Glass Dispersion Prism",
    subtitle: "Laboratory-polished 150mm equilateral glass prism"
  },
  {
    name: "honey-crock",
    gradient_type: :vertical_reverse,
    badge: "RARE HARVEST   $36",
    title: "Wild Mountain Honey in Glazed Stoneware",
    subtitle: "Single-source unfiltered raw botanical honey"
  }
]

images.each do |img|
  full_webp = File.join(assets_dir, "#{img[:name]}.webp")
  thumb_webp = File.join(assets_dir, "#{img[:name]}-thumb.webp")
  jpg_path = File.join(assets_dir, "#{img[:name]}.jpg")

  # Generate clean white-to-black/dark-gray gradient image with no text
  cmd_full = "convert -size 1200x675 gradient:'#F8F9FA-#1A1A1A' -quality 90 \"#{full_webp}\""
  system(cmd_full)

  # 2. Generate optimized thumbnail (600x338)
  cmd_thumb = "convert \"#{full_webp}\" -resize 600x338 -quality 82 \"#{thumb_webp}\""
  system(cmd_thumb)

  # 3. Create JPG for fallbacks
  cmd_jpg = "convert \"#{full_webp}\" -quality 85 \"#{jpg_path}\""
  system(cmd_jpg)

  puts "Generated clean gradient dummy asset: #{img[:name]}.webp, #{img[:name]}-thumb.webp, #{img[:name]}.jpg"
end

puts "All #{images.size} gradient dummy image assets generated successfully."
