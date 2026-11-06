// Every tunable number for Starborne Nursery lives here as a named export.

// The island turns on the keyboard alone. There was a ROTATE_SENSITIVITY here - radians of spin per
// pixel dragged - and the makers cut it, so a click on the island selects a tile and nothing else.
export const ROTATE_KEY_SPEED = 1.8;      // radians per second when holding A/D
export const ROTATE_SMOOTHING = 0.15;     // how fast the spin eases toward its target
export const SNAP_EASE = 0.12;            // easing speed of the auto-snap
// Bigger at the makers' request, for visibility: 2 -> 2.5. Every size built off a tile follows this
// number rather than being written down a second time, so the island, the pool, the pad, the bed,
// the platform and the props all grew together and still line up.
export const TILE_SIZE = 2.5;             // width of one island tile
export const TILE_HEIGHT = 0.7;           // height of one island tile
export const CAMERA_DISTANCE = 16;
export const CAMERA_HEIGHT = 12;
export const SKY_COLOR = '#87b5e0';
export const GRASS_COLOR = '#6a8f4e';
export const SOIL_COLOR = '#6b4a2f';
// 45, not 60. A judge plays for about three minutes, and at a train a minute they might only watch
// two go by - which is not long enough to see that missing one costs nothing and the next is
// coming. At 45 the same three minutes holds three or four visits, and the wait is still long
// enough that the train reads as an event rather than a vending machine.
export const TRAIN_INTERVAL = 45;         // seconds between trains
// Set to 20 at the makers' request, down from 50: a visit is now a short, brisk stop. Twenty seconds
// is still several times a walk out to the deck and back, so the trade is never a scramble - but it
// is short enough that the train reads as calling in and moving on rather than waiting for you.
export const TRAIN_WAIT_TIME = 20;        // seconds the train waits at the platform
// The first train of a run, and the only one that waits for the player instead of the other way
// round. The makers asked for it because a run now starts with an empty pool: the first thing a
// player has to do is buy an egg, and the shop is on the train. Four seconds is long enough to see
// it come in and short enough that nobody stands about with nothing to do.
export const TRAIN_FIRST_DELAY = 4;       // seconds until the first train of a run arrives
export const WINDOW_TIGHTEN = 0.85;       // how much the window shrinks per visit
export const ALIGN_TOLERANCE = 6;         // degrees off-line that still counts
// The island is never quite still. It turns on its own at this rate, always the same way, so the
// player has something to line up every visit instead of lining it up once and never again. The
// number is chosen against the clock: TRAIN_INTERVAL is 45 seconds and ALIGN_TOLERANCE is 6 degrees,
// so at 0.15 the island slips just out of line - 6.75 degrees - in the quiet between two trains.
// That is one small correction per train: felt, but never a fight. Zero makes the island motionless
// until the player touches it, and much above 0.25 means chasing it.
export const ISLAND_DRIFT_DEG = 0.15;     // degrees per second the island turns on its own

// --- The creature and its pool (M3) ---
export const POOL_COLOR = '#4a86b8';      // the water in the pool
export const POOL_RIM_COLOR = '#8fa6b8';  // the stone lip around it
export const POOL_INSET = 0.62;           // pool width as a fraction of one tile
export const POOL_DEPTH = 0.22;           // how far the water sits below the grass top
export const CREATURE_BOB = 0.12;         // how far the creature bobs in the water
export const CREATURE_BOB_RATE = 1.6;     // bobs per second
export const HUNGER_START = 0.7;          // hunger at the start, 1 = full, 0 = empty
export const HUNGER_RATE = 0.02;          // hunger lost per second
export const FEED_AMOUNT = 0.45;          // hunger one feeding restores
// The makers start the game with a full cycle already in hand: one minnow can be raised all the way
// from egg to adult without waiting for the train. The arithmetic, out of the growth numbers below.
// The three stages cost GROWTH_TIMES 8 + 12 + 16 = 36 seconds of growth, and growth only ticks
// while hunger is over GROWTH_HUNGER_MIN. Hunger starts at 0.7, which is (0.7 - 0.35) / 0.02 = 17.5
// of those seconds on its own, and a feed taken at the floor lifts hunger to 0.8 and buys another
// 22.5. So 36 seconds costs two feeds if every one of them lands at the perfect moment - and
// nobody feeds at the perfect moment, because a feed taken while the minnow is still full caps at 1
// and wastes the rest of it. Five leaves about half a cycle of slack: enough that a player learning
// the pacing still gets their adult, and few enough that the shop and the bed both matter.
// There used to be a FEED_PER_DOCK here: the train dropped off two feeds every time it docked, and
// the makers cut it. Food comes from the train's shop or from the planting bed now.
export const FEED_START = 5;              // feed the player begins with
export const GROWTH_HUNGER_MIN = 0.35;    // a creature only grows while hunger is above this
// Shortened at the makers' request - the minnow grows faster now, so a whole life is about half the
// time it was. The three stages cost 8 + 12 + 16 = 36 seconds of growth.
export const GROWTH_TIMES = [8, 12, 16];  // seconds spent in egg, hatchling, juvenile before growing on

// --- The Launch (M4) ---
export const LAUNCH_DURATION = 3.5;         // seconds of the launch moment
export const LAUNCH_PAD_COLOR = '#8fa6b8';  // the stone ring on the right-hand tile
export const LAUNCH_GLOW_COLOR = '#ffe9a8'; // the light a release leaves behind
export const LAUNCH_SPIRIT_RADIUS = 0.3;    // size of the shape that rises
export const LAUNCH_CIRCLE_RADIUS = 4.5;    // how wide the arc is, in world units
export const LAUNCH_RISE_HEIGHT = 15;       // how high it climbs before it fades out
export const LAUNCH_TURNS = 1;              // full circles it makes on the way up
export const LAUNCH_PAD_INSET = 0.5;        // pad width as a fraction of one tile
export const LAUNCH_PAD_DEPTH = 0.12;       // how far the pad sits above the grass
// Five, not one. A launch is the only way starlight is earned, and the makers priced a bed, a pool
// and the first cousin at 10 starlight: at one light per release that is ten releases for the first
// thing you can buy with it, which is far more than a three-minute play will ever see. At five, a
// launch is worth something on its own and the makers' prices are two launches' worth of care - the
// prices are untouched, and only the rate they are measured against moved.
export const STARLIGHT_PER_LAUNCH = 5;      // Starlight earned per release

// --- The two currencies: coins and starlight ---
// Coins are the train's money and starlight is the sky's. They are kept apart on purpose: coins are
// bought and spent on the island, starlight is earned by releases and spent on the creatures.
//
// The coin loop is a TRADE, not a gift, but the makers set feed flat at 10 both ways: the train pays
// for a feed exactly what it charges for one. That makes the train a pantry rather than a market -
// you can swap coins for meals and back at no loss, and nobody can make money out of it. The money
// in the game now comes from the planting bed instead: a seed costs 5 and grows into a feed the
// train pays 10 for, so growing is how a player gets ahead, and the train is where that gets turned
// into coins and back into meals when the bed is not fast enough.
// The makers start the player with a purse rather than an empty pocket: a hundred coins is a few
// feeds and a few seeds, so the first visit to the train is a choice about what to spend on rather
// than a look at what you cannot afford.
export const COINS_START = 100;
export const COINS_PER_FEED_SOLD = 10;      // what the train pays for one feed
export const COINS_PER_FEED_BOUGHT = 10;    // and what it charges for one back: the same, by the makers' call
// A seed is what planting spends now: the train sells them, and G puts one in the ground. Half a
// feed, because half a feed is what it becomes - the grow time is the price on top of the coins.
export const COINS_PER_SEED = 5;
export const SEEDS_START = 5;               // five seeds in hand at the start, the makers' number

// Starlight is what a launch pays, and it is spent in two places now. At the pool it buys time:
// STARLIGHT_PER_HASTE of it hurries the minnow on by HASTE_GROWTH_SECONDS of its current stage. The
// three stages are 8, 12 and 16 seconds, so a hurry is the whole of the shortest one and half of the
// longest - enough to feel like something, small enough that saving starlight up still matters.
export const STARLIGHT_PER_HASTE = 1;
export const HASTE_GROWTH_SECONDS = 8;
// And at the train's shop it buys more kinds of fish. The makers changed their minds about the
// decorations: beds and pools were 10 starlight each and are 10 coins each, the same money as feed,
// seeds and eggs. So the ground and the water are bought with the everyday currency and starlight is
// left meaning one thing - a rarer creature than the one you have. Their prices throughout: an egg
// is 5 coins, a crop bed and a pool are 10 coins each.
export const COINS_PER_EGG = 5;             // the makers' price for the egg that starts a creature
export const DECOR_PLOT_COST = 10;          // coins for one more crop bed
export const DECOR_POOL_COST = 10;
export const DECOR_TILE_COST = 1;           // starlight for one more tile of island, the makers' price
// A kind costs more light than a single launch pays, so unlocking one is a couple of launches' care.
// Keyed by the kind ids in creature.js, which is where the kinds and their colours live - the makers
// set the egg and decor prices, and these two follow the same shape rather than inventing another.
export const KIND_COSTS = { cloudminnow: 0, duskfin: 10, emberfin: 20, whalekin: 30 };

// Decor: where the seed money goes once you have feed to spare. A seed is bought from the train for
// COINS_PER_SEED and G plants it, so the coin price of a decoration is now the price of a seed and
// there is one number rather than two. The decoration stays, so the island slowly becomes somewhere
// that has been lived on: a sink, not a mechanic - nothing here changes a rule.

// --- Tile heights and caves (the doc's raise/lower) ---
export const TILE_LEVEL_STEP = 0.9;       // vertical gap between the three fixed tile heights
export const TILE_LEVEL_START = 1;        // every tile starts in the middle
export const TILE_LEVEL_MIN = 0;          // lowest a tile can sit
export const TILE_LEVEL_MAX = 2;          // highest a tile can sit
export const TILE_SLIDE_TIME = 0.7;       // seconds a tile takes to slide to a new height
export const STEP_MAX_RISE = 1;           // levels a walker can climb between neighbouring tiles
export const CAVE_COLOR = '#161c26';      // the dark under a raised tile
export const CAVE_DEPTH = 1.3;            // how tall the cave mouth is
export const CAVE_REVEAL_LEVEL = 2;       // a tile must be raised to this level to open its cave
export const FOCUS_RING_COLOR = '#fff3b0'; // the mark drawn where the player last clicked
// The makers wanted this to be a point, not a circle: it used to be a ring sized to a whole tile -
// 1.7 units across, nearly the island's own width - which read as a hoop round the island rather
// than as "you pointed here". It marks the exact spot that was clicked now, and the tile it happens
// to fall inside is still what Q and R move, because that is the tile the click selected.
export const FOCUS_RING_RADIUS = 0.16;    // world units across the whole mark

// --- The clock and the sky (the doc's TimeManager, on the device's real clock) ---
export const DAY_LENGTH_MINUTES = 24;     // real minutes for one full day and night
// The makers chose to OPEN AT DUSK rather than to match the player's own clock, so the deep blues,
// the starlight and the glowing creatures are all in the first frame anyone sees - and a judge who
// plays for three minutes never sees the flat midday. 19.5 is deliberately between the keyframes:
// 18 is the last of the orange and 20 is full night, so half past seven starts you in the violet
// ramp with the stars already coming up, with about half a minute of dusk left to watch go.
export const TIME_START_HOUR = 19.5;
export const DEBUG_TIME_STEP = 3;         // hours skipped per press of the fast-forward key
export const SUN_DISTANCE = 34;           // how far out the sun and moon sit
export const DAY_SKY_COLOR = '#87b5e0';
export const DUSK_SKY_COLOR = '#e0956a';
export const NIGHT_SKY_COLOR = '#2b2f5e';
export const DAWN_SKY_COLOR = '#c98ba0';
export const DAY_LIGHT_COLOR = '#ffffff';
export const DUSK_LIGHT_COLOR = '#ffc78a';
export const NIGHT_LIGHT_COLOR = '#7b86d6';
export const DAY_LIGHT_INTENSITY = 2.0;
export const NIGHT_LIGHT_INTENSITY = 0.5;
export const DAY_AMBIENT_INTENSITY = 1.2;
export const NIGHT_AMBIENT_INTENSITY = 0.4;
// Bigger at the makers' request, so the two bodies read as a sun and a moon and not as two pale
// dots: 2.2 -> 2.9 and 1.4 -> 2.0. A body's size is its true radius in world units, so a bigger
// number is a bigger disc in the sky.
export const SUN_SIZE = 2.9;
export const MOON_SIZE = 2.0;
// How flat the sun's and the moon's arc is. This is the number that decides whether anyone ever
// SEES them, and it was worked out from the camera rather than by eye: the camera looks down at the
// island from 12 up and 15 out, so a body on a full-height arc is straight overhead at noon - off
// the top of the frame - and the sun has sunk out of sight by the time it comes back into shot.
// Measured against the camera, at 1 the sun is never in frame while it is above the horizon and the
// moon is only in frame in the morning; at 0.16 the sun sits in shot from 18:45 to 20:15, which is
// the dusk every run opens in, and the moon is in shot from 23:15 through the night. The light
// keeps the true, steep arc, so the island's own shading is exactly what it always was.
export const SUN_MOON_ARC_FLAT = 0.16;
// And which way round the moon's own arc lies, in degrees about the world's up axis. Exactly
// opposite the sun - the moon's own default - the moon is only ever in shot in the morning, which
// is why nobody had ever seen one. Turned three quarters of the way round, the moon keeps its
// ordinary day (up at 18:00, highest at midnight, down at 06:00) but crosses the part of the sky
// the camera sees at 21:00 instead: from 21:00 to 00:45 it is in shot every night, which is the
// stretch anyone who starts at dusk is still playing through. It also leaves the sun a wide berth:
// at 19:30 the two are 59 degrees apart, so the sunset and the moonrise never sit on each other.
export const MOON_ARC_TURN_DEG = 270;

// --- Weather (the doc's WeatherManager) ---
export const WEATHER_MIN_MINUTES = 0.8;   // shortest a spell of weather lasts
export const WEATHER_MAX_MINUTES = 2.5;   // longest a spell lasts
export const WEATHER_TABLE = ['clear', 'clear', 'clear', 'rain', 'wind', 'storm'];  // weighted by repeats
export const WEATHER_TINT_MAX = 0.45;     // how far a spell is allowed to darken the sky
export const WEATHER_TINT_RAIN = '#6f7f95';
export const WEATHER_TINT_WIND = '#9fb3c4';
export const WEATHER_TINT_STORM = '#3a3f55';
export const RAIN_COUNT = 900;
export const RAIN_COLOR = '#a8c8e8';
export const RAIN_FALL_SPEED = 24;
export const RAIN_AREA = 28;              // width of the box the rain falls inside
export const RAIN_TOP = 22;
export const RAIN_BOTTOM = -2;
export const WIND_STRENGTH = 1.6;
export const WIND_GUST_RATE = 0.7;
export const STORM_FLASH_MIN = 2.5;       // seconds between lightning flashes in a storm
export const STORM_FLASH_MAX = 8;
export const STORM_FLASH_DECAY = 6;       // how fast a flash fades
export const STORM_FLASH_LIGHT = 2.5;     // brightness a flash adds

// --- The Caretaker ---
// The makers drew the Caretaker (context/caretaker.png) and described her: a chibi with a big head
// and a short body, a deep navy hood worn up into a short capelet, pale gold hair in a bob with the
// bangs swept over one eye, a small gold four-pointed star at the collar, and a plain white
// bell-sleeved tunic over bare legs. The palette below is theirs - navy, white, pale gold, soft skin
// - and it holds no pink, no grey and no second blue, so the figure reads as one quiet object
// against the island's greens, browns and greys, and the star is the only thing on it that shines.
export const CARETAKER_SPEED = 2.2;       // world units per second
export const CARETAKER_HEIGHT = 0.9;      // the WHOLE figure: the soles of the feet to the hood's point
export const CARETAKER_TURN_RATE = 10;    // how fast it swings to face where it is walking
export const CARETAKER_ARRIVE = 0.12;     // distance at which a waypoint counts as reached
export const CARETAKER_START_TILE = 0;    // which tile it starts on, as an index into island.tiles
export const INTERACT_RANGE = 1.5;        // how close the Caretaker must be to use something
// The hood, and the capelet it drops into. The capelet is a shade lighter, because the hood sits in
// its own shadow and the two are the same cloth: without the step they would merge into one shape.
export const CARETAKER_HOOD_COLOR = '#2b3252';
export const CARETAKER_CAPE_COLOR = '#353d63';
// The tunic. A soft warm white rather than a paper white, so it does not glare at a sunset.
export const CARETAKER_ROBE_COLOR = '#f5f1e8';
// The hair, and the clasp. The star is the one warm accent on the figure now the pink scarf is gone.
export const CARETAKER_HAIR_COLOR = '#efdc9c';
export const CARETAKER_STAR_COLOR = '#f2c94c';
// Skin, for the face and for the bare legs under the hem. One colour for both: the face carries
// almost no features, and a second tone would only draw a seam across the head.
export const CARETAKER_SKIN_COLOR = '#f6e5d2';
// The single visible eye. A cool near-black, half closed - which is the whole of the expression.
export const CARETAKER_EYE_COLOR = '#3b3550';

// --- Look: the island's cross-section (M4, from the reference images in context/) ---
// The defining trait of the references: the island is a cut-open dollhouse block. A living grass
// cap overhangs a warm soil band, which tucks in over the grey stone it was torn out of. The three
// LAYER fractions must sum to 1, because together they are the whole of TILE_HEIGHT and the grass
// top has to stay exactly there - every module reads that face through island.getSurfaceY.
export const GRASS_LIP_COLOR = '#86ab5c';   // the brighter edge the grass shows where it lips over
export const DIRT_COLOR = '#8a5a3a';        // the warm band under the grass
export const ROCK_COLOR = '#5f5750';        // the stone the island is broken off at
export const GRASS_LAYER = 0.26;            // fraction of TILE_HEIGHT that is living grass
export const DIRT_LAYER = 0.46;             // the next fraction down that is soil

// --- The centre tile's longer root (M4) ---
// The middle tile is the island's anchor - the pool sits on it and the Caretaker starts beside it -
// so it is given a longer stone root than the two tiles it carries between. Every tile already has
// a rock band of its own (ROCK_LAYER, the rest of TILE_HEIGHT below the soil); this hangs an extra
// mass below that, under the centre only, so the island reads as one block hung from a keel rather
// than three blocks floating side by side. It is decoration: getSurfaceY measures the grass top,
// which is unaffected, and nothing walks or stands on the underside.
export const CENTRE_ROCK_DROP = 1.7;        // how far the centre tile's root reaches below its base
export const GRASS_OVERHANG = 1.03;         // grass width vs the tile, so the cap lips over the soil
// The two bands below the cap must stay at 1.0, and that is not a style choice. The tiles sit
// exactly TILE_SIZE apart, so any width below TILE_SIZE leaves a slot between neighbouring tiles
// with open sky showing through it. The reference island reads as one unbroken block with the
// grass lipping over a near-vertical cliff, and that is what these two do. Only the grass cap,
// which is the one band allowed to overlap its neighbour, is wider than one tile.
export const DIRT_TAPER = 1.0;              // the soil band's width vs the tile: flush, so tiles meet
export const ROCK_TAPER = 1.0;              // and the stone's, for the same reason

// --- Look: the stepped terrain (the makers' request) ---
// The grass top is not one flat plate. Each tile carries a grid of voxel columns over its cap, and
// every column either stays on TILE_HEIGHT or stands a whole number of TERRAIN_LEVELs above it - so
// the surface steps in flat-faced blocks rather than ramping, which is what keeps it voxel rather
// than a hill. The steps belong to the front and back bands of a tile; the middle of the tile, the
// pool, the pad, the planting bed and the walk out to the platform all stay exactly on TILE_HEIGHT,
// because island.getSurfaceY is what the Caretaker, the props and main.js's spots all stand on.
export const TERRAIN_LEVEL = 0.1;              // one voxel level in height, the quantum every step snaps to
// Measured in plan, so a tile is a whole number of blocks across and the grid never ends in a sliver.
// At five to a tile the block is 0.5: chunky enough to read as a block from the camera, fine enough
// that the two bands together still make a shape rather than one long wall.
export const TERRAIN_STEP = TILE_SIZE / 5;     // one voxel block across: 0.5 at the new tile size
export const TERRAIN_MAX_UP = 3;               // the tallest a column may stand above the flat level, in levels
// The strip along each tile's own z centre that never steps: the line the Caretaker walks the row
// on, and where the pool, the pad and the bed put their own flat ground. 0.3 of a tile each side is
// 0.75, which is exactly one and a half blocks - so the flat strip begins and ends on a block edge
// and no block straddles it.
export const TERRAIN_SPINE = 0.3;              // the fraction of the tile each side of its z centre that stays flat
export const TERRAIN_GRASS_COLOR = '#7d9e58';  // a raised block's top: the cap's own green, a step paler so it reads
export const TERRAIN_ROCK_COLOR = '#6f665e';   // and its sides: the stone the step was broken out of

// --- Look: what grows on the island (M4) ---
export const PROP_TRUNK_COLOR = '#6b4a2f';
export const PROP_TREE_COLORS = ['#3f6b39', '#54884a', '#7aa85c']; // darkest low, palest on top
export const PROP_CANOPY_LAYERS = 3;        // stacked cones, so a tree reads as a pine
export const PROP_TREE_HEIGHT = 1.9;        // tallest tree, in world units
export const PROP_TREE_RADIUS = 0.55;       // its widest cone, so trees never swallow a tile
export const PROP_BUSH_COLOR = '#5f9450';
export const PROP_STONE_COLOR = '#9d9aa0';
export const PROP_MUSHROOM_CAP = '#d4614c';
export const PROP_MUSHROOM_STEM = '#f0e6d2';
export const PROP_FLOWERS = ['#f4c2d7', '#f7e9a6', '#e79ab5', '#cfe4f5'];
export const PROP_PER_TILE = 8;             // small props scattered on each tile
export const PROP_SEED = 20279;             // fixed, so the island looks the same on every launch
export const PROP_EDGE_MARGIN = 0.78;       // props stay inside this fraction of a tile

// --- The planting bed (the makers' plot) ---
// A seed goes into the bed, and GROW_TIME seconds later there is a crop standing in it. Picking it
// is a feed for the minnow, so the bed is the island's own slow way of making food: the train sells
// feed for coins, and the bed turns a cheaper seed into the same meal.
export const GROW_TIME = 5;                 // seconds from planting a seed to the crop being ripe
export const PLOT_SIZE = TILE_SIZE * 0.45;  // 1.125: the bed's footprint, just under half a tile
export const PLOT_SOIL_COLOR = '#4a3b2c';   // turned earth
export const PLOT_FRAME_COLOR = '#7a5c3c';  // the timber it is edged with
export const PLOT_SPROUT_COLOR = '#7fbf6a'; // the seedling while it is still growing
export const PLOT_RIPE_COLOR = '#f2c94c';   // and the gold it turns when there is something to pick

// --- Look: the sky (M4) ---
// The dome is a huge inside-out ball the camera sits inside. It never sets scene.background:
// daynight.js owns that, and main.js hands its colour here each frame, so one clock still
// drives the whole sky and weather still tints it.
export const SKY_DOME_RADIUS = 120;
export const SKY_ZENITH_DEEPEN = 0.38;      // how much deeper the colour is straight overhead
export const SKY_HORIZON_LIFT = 0.34;       // and how much paler it is down at the horizon
export const CLOUD_COUNT = 22;
export const CLOUD_COLOR = '#ffffff';
export const CLOUD_OPACITY = 0.55;
export const CLOUD_SPAN = 95;               // radius of the ring the clouds drift in
export const CLOUD_HEIGHT_MIN = 8;
export const CLOUD_HEIGHT_MAX = 40;
export const CLOUD_SIZE_MIN = 16;
export const CLOUD_SIZE_MAX = 38;
export const CLOUD_RISE = 0.42;             // a puff's height as a fraction of its width
export const CLOUD_DRIFT = 0.45;            // world units per second
export const CLOUD_NIGHT_TINT = '#8f9ac4';  // the pale clouds go violet-grey after dark
export const STAR_COUNT = 520;              // more of them at the makers' request: 320 -> 520
export const STAR_COLOR = '#fff3cf';
export const STAR_SIZE = 0.62;
export const STAR_OPACITY = 0.95;
export const STAR_TWINKLE = 1.6;            // how fast the stars breathe
export const STAR_SPAN = 105;               // radius of the ball the stars sit on
export const STAR_FLOOR = -0.05;            // stars only above this height, in units of STAR_SPAN
export const MOTE_COUNT = 70;               // the daytime sparkles drifting up near the island
export const MOTE_COLOR = '#fff0c4';
export const MOTE_SIZE = 0.42;
export const MOTE_RISE = 0.14;              // world units per second, very slow
export const MOTE_SPAN = 26;                // how wide the column of motes is
export const MOTE_TOP = 16;                 // and how high they climb before recycling

// --- Look: the release, as a ray instead of a ball (M4) ---
export const LAUNCH_RAY_SPAN = 1.4;         // tip to tip, so it reads as a ray and not a pebble
export const LAUNCH_RAY_SWEEP = 1.05;       // how far the wings sweep back
export const LAUNCH_RAY_BODY_COLOR = '#9fd2f7';
export const LAUNCH_RAY_GLOW_COLOR = '#fff3c4';
export const LAUNCH_TRAIL_COUNT = 44;       // motes of light left in its wake as it climbs
export const LAUNCH_TRAIL_LENGTH = 6;       // how far back the wake reaches, in world units
export const LAUNCH_TRAIL_SPREAD = 0.55;    // how wide the wake scatters either side of the path
export const LAUNCH_TRAIL_RISE = 0.4;       // and how much it lags below the ray as well as behind

// --- Look: the Sky Train (M4) ---
export const TRAIN_RAIL_COLOR = '#5a6270';      // the track, a cold grey against the warm island
export const TRAIN_RAIL_TOP_COLOR = '#7d8695';  // its lit upper face, so the rail reads as sleepers
// The makers' liveries: navy, gold and white, one car each, with a navy roof over them all and a
// white window band under it. The first colour is the lead car, so the train comes in navy.
export const TRAIN_CAR_COLORS = ['#1f3a68', '#c9a227', '#f2ecdd']; // navy, gold, white
export const TRAIN_CAR_ROOF_COLOR = '#132445';  // a deeper navy, so the roofline reads as one roof
export const TRAIN_CAR_TRIM_COLOR = '#fdf6e6';  // the white window band: what makes a car a car
export const TRAIN_SEAM_COLOR = '#fff3b0';      // the alignment glow, kept from the grey box

// The train's own size, all of it tunable: make these bigger and the whole train grows, because
// every one of them is what train.js builds the cars from. Length and spacing are in TILE_SIZE
// fractions, so a car keeps its size against the island's tiles rather than against nothing.
export const TRAIN_CAR_LENGTH = TILE_SIZE * 0.94;   // 2.35 nose to tail
export const TRAIN_CAR_WIDTH = TILE_SIZE * 0.52;    // 1.30 across the body
export const TRAIN_CAR_HEIGHT = 0.64;               // 0.64 of body, plus the roof above it
export const TRAIN_CAR_SPACING = TILE_SIZE * 1.03;  // 2.575 nose-to-nose: a car and its gap
export const TRAIN_CAR_ROOF_OVERHANG = 0.05;        // how far the roof lips over the body's sides

// --- Where the track sits ---
// The track is a fixture of the world now, not a thing the island carries. It has one heading
// (TRAIN_RAIL_ANGLE_DEG) and one height (TRAIN_RAIL_GROUND_Y) and it keeps them: it does not swing
// round between visits and it does not ride the middle tile up and down. The island is what moves.
// That is why every number below is a distance from the island's own centre: the island turns under
// a track that stays exactly where it is, and these are what the turn is measured against.
//
// TRAIN_SETBACK is the one that matters. The island's longest reach is its corner: half a tile deep
// and one and a half tiles long, so 3.95 from the centre now the tiles are 2.5 across. The rail is
// RAIL_WIDTH / 2 = 0.31 either side of its own centreline, so its near edge has to sit further out
// than 3.95 or the island's corner sweeps into the track at the angles where it points at it.
// This number used to be 3.8, which kept 0.39 clear of a 2.0 tile whose corner only reached 3.16 -
// it could not survive the island growing, and at 3.8 the raised rim blocks cut visibly into the
// rail. The clearance the old comment described is what 4.65 restores: 4.65 - 0.31 = 4.34 against a
// corner of 3.95, so 0.39 again. It carries the platform out with it (PLATFORM_LENGTH follows), which
// is why the two move together and why the deck grew when the island did.
export const TRAIN_SETBACK = 4.65;        // from the island's own centre out to the rail
// The track's fixed heading, in degrees, measured the same way the island's own angle is. This is
// the rail's yaw, not the island's: the island lines up a quarter turn off it (TRAIN_ALIGN_OFFSET),
// so the two are decided together and must be read together.
//
// The camera never moves, and it stands at about 55 degrees round from world +X. The group is
// parked at cos and sin of this heading, so the heading is really "which way the railway is from
// the island's centre". 162 is the makers' choice and it is a 180-degree flip of where this started:
// the railway now stands at about 198 degrees, the quarter diametrically opposite the lens, so the
// island is between the camera and the train and the platform reaches away from us rather than
// toward us. A flip like that leaves the framing alone otherwise - the track still runs across the
// view rather than down it, and the lined-up island still shows about four fifths of its length,
// because none of that is read off this number, only off the right angle between the two.
//
// At the old -18 the pier pointed in at the viewer and its length read short; at 162 that same
// length reads as depth instead, with the deck and the train sitting behind the island. Turn it and
// the whole railway swings round the island.
export const TRAIN_RAIL_ANGLE_DEG = 162;  // the track's heading, in degrees, fixed for the whole run
// The rail's own ground plane: the middle tile's grass top when that tile is sitting at its
// starting level. island.js puts every tile at levelToY(TILE_LEVEL_START) = 0, and the grass cap's
// top face is TILE_HEIGHT above the tile's origin, so that face is exactly TILE_HEIGHT. The platform
// deck is built on this plane, so at the starting level the two decks meet flush - and if the player
// raises or lowers the middle tile, the island leaves the platform behind. That is deliberate, and
// BOARD_LEVEL_TOLERANCE below is where it is measured.
export const TRAIN_RAIL_GROUND_Y = TILE_HEIGHT;
// TRAIN_RAIL_RISE is the rail's height above that plane, not an absolute one. It sits at deck height
// because the track no longer crosses the island and has nothing to clear: the train meets the
// Caretaker level instead of overhead.
export const TRAIN_RAIL_RISE = 0.15;      // the rail's height above that ground plane
// The island turns a quarter turn off the track, so the track runs ALONG its long front edge
// rather than over its middle. isAligned() compares against railAngle + this.
export const TRAIN_ALIGN_OFFSET = Math.PI / 2;

// --- The platform beside the track ---
// The makers moved the boarding point off the island and onto the railway. There is no pier hanging
// off the island any more; instead this platform is built onto the side of the track, facing in.
// When the island is aligned its front edge meets the platform's near edge and the Caretaker walks
// straight across - level, with nothing to climb, because both decks sit at the same height.
//
// It hangs off the RAIL group rather than the island, so it turns with the track and stays put
// beside it. That is what makes it read as part of the railway instead of part of the island.
//
// PLATFORM_LENGTH is not a free number: it is exactly the gap between the island's own edge and
// the track's centreline, so the two meet with no space left between them when the island is lined
// up. Change TRAIN_SETBACK and this follows.
export const PLATFORM_LENGTH = TRAIN_SETBACK - TILE_SIZE / 2;   // 3.4: island edge to rail centreline
export const PLATFORM_WIDTH = TILE_SIZE * 0.6;   // 1.5 wide against a Caretaker 0.56 across
export const PLATFORM_DECK_COLOR = '#a9834f';    // warm weathered planks
export const PLATFORM_BEAM_COLOR = '#7a5734';    // the darker framing under the deck
export const PLATFORM_POST_COLOR = '#6b4a2f';
export const PLATFORM_POST_DROP = 1.9;           // how far the posts run on down below the deck
export const PLATFORM_RAILING_COLOR = '#8a5a3a';
export const PLATFORM_RAILING_HEIGHT = 0.42;
export const PLATFORM_RAILING_THICK = 0.07;
export const PLATFORM_PLANK_COUNT = 11;          // deck boards down its length, so it is not one slab
export const PLATFORM_BEAM_DROP = 0.14;          // how far the deck's own frame hangs below it

// --- Boarding: lining up, and holding the train ---
// Three rules, and they are different shapes, so they are asked for in different ways.
//
// Lining up is a distance from ONE point: the platform's near edge, which is the island's own front
// edge, and therefore a spot on the grass the Caretaker can always walk to whatever way the island
// happens to be facing. Walk toward the edge and the island eases itself the last few degrees onto
// the rail - the design doc's "snap into place" moment. Measure it from the far end of the platform
// instead and the point would be out over open sky, where nobody can stand, so the island could
// never bring itself round at all. 0.9, not a wider ring: this is meant to cost a walk to the edge,
// and at 1.3 it fired from the middle of the tile and the walk stopped meaning anything.
//
// Holding the train is not a distance at all. It is "is the Caretaker standing on the platform",
// asked of the platform itself, so the answer is exact - on the deck holds it, on the grass one step
// short does not, and there is no radius to pick and no fuzzy rim where it half-works.
//
// Level, the third rule, is how far the middle tile may be off the platform's own plane and still
// let the Caretaker walk across. The track is nailed to the world and the island is not, so raising
// or lowering the middle tile lifts the island's edge away from a deck that stays exactly where it
// is - which is what the makers chose, and it is how the height mechanic reaches the train. One
// TILE_LEVEL_STEP is 0.9, so 0.1 lets the last hand's width of a slide count and nothing more: a
// tile heading for another level is never walkable across, and a tile that has settled there stays
// out of reach until the player puts it back.
export const AUTO_SNAP_RANGE = 0.9;      // from the island's edge, this close eases the island round
export const TRAIN_HOLD_MAX = 45;        // longest a held train will wait past its own window
export const BOARD_LEVEL_TOLERANCE = 0.1; // world units the middle tile may sit off the deck's plane

// --- Sound (M4) ---
// Every sound is generated in code by WebAudio, so there are no audio files to download, nothing
// to ship, and nothing to lose. The whole score is a soft bed under the game and three short
// moments: feeding, growing, and the release.
// Raised from 0.45 when the music arrived. Even with the bed, the pad, a feeding chime and a motif
// note all sounding at once the mix only reaches about two thirds of full scale, so the higher
// ceiling buys the music room to be heard without ever pushing a single voice into a clip.
export const AUDIO_MASTER_VOLUME = 0.60; // the ceiling on everything below it
export const AUDIO_FADE_IN = 1.5;        // seconds the bed takes to come up, so it never startles
// Raised from 0.10. At 0.10 the drone read as a hum the makers could not hear under the game; at
// 0.16 it is plainly there and still the quietest layer, sitting below the pad and the motif.
export const AUDIO_BED_LEVEL = 0.16;     // the drone under the whole game, at its loudest
export const AUDIO_BED_LOW = 98;         // Hz: a low, warm root
export const AUDIO_BED_HIGH = 147;       // and its fifth, so the two beat gently against each other
export const AUDIO_WIND_LEVEL = 0.12;    // filtered noise added on top when the wind gets up
export const AUDIO_RAIN_LEVEL = 0.10;    // and the brighter hiss of rain
export const AUDIO_FILTER_CALM = 400;    // Hz: how open the wind filter is in calm weather
export const AUDIO_FILTER_STORM = 1400;  // and how open it gets in a storm
export const CHIME_NOTES = [523.25, 659.25, 783.99];  // C5 E5 G5: a rising major triad
export const CHIME_STEP = 0.11;          // seconds between the notes of a chime
export const CHIME_DURATION = 0.9;       // how long each note rings for
// Raised with the bed, so a chime still arrives on top of the louder music rather than sinking into it.
export const CHIME_LEVEL = 0.20;
export const GROWTH_NOTES = [659.25, 987.77];  // E5 B5: two notes, a small bright lift
export const LAUNCH_LOW = 110;           // Hz where the release swell starts
export const LAUNCH_HIGH = 880;          // and where it peaks, over LAUNCH_DURATION seconds
export const LAUNCH_LEVEL = 0.26;        // raised with the rest, so the one big moment still tops the mix
export const LAUNCH_SHIMMER_NOTES = [1046.5, 1318.5, 1568.0];  // high, quiet, sparkling on top

// --- Sound: the music, and the small sounds of a hand (added on top of the M4 block above) ---
// The block above is the bed and the three big moments; this is the soft music that sits over the
// bed and the short sounds of the everyday actions - planting, picking, buying, selling, and the
// sky train coming and going. Every number here is a maker's knob: levels, note sets, gaps, pitches,
// durations, and the band and level of the stone creak while the island is being turned.
//
// The music is two layers. A warm pad holds one chord for AUDIO_PAD_CHORD_SECONDS at a time and
// drifts through four chords that never land on a hard cadence, and over it a sparse motif walks
// slowly through a pentatonic scale, a few seconds apart, sometimes one note and sometimes two.
// Both are drawn from a fixed integer hash rather than Math.random, so the tune is the same tune on
// every reload - the same trick island.js uses for the shape of the terrain.
export const AUDIO_PAD_LEVEL = 0.11;        // the warm chord pad under everything, at its loudest
export const AUDIO_PAD_TYPE = 'sine';       // sine voices: no buzz, so four chords stay soft
export const AUDIO_PAD_CHORD_SECONDS = 26;  // seconds one chord is held before the next arrives
export const AUDIO_PAD_ATTACK = 5;          // seconds a chord takes to fade up, so the two overlap
export const AUDIO_PAD_RELEASE = 6;         // and how long the old chord takes to fade away
// Four chords, each a set of Hz notes, an octave or two apart so the pad has some width. Am, F, C, G
// - the old cosy loop. There is no dominant seventh anywhere in it, so no chord ever pulls hard
// toward the next: the progression drifts rather than resolves.
export const AUDIO_PAD_CHORDS = [
  [110.00, 164.81, 261.63],   // A2 E3 C4  - Am
  [87.31, 130.81, 220.00],    // F2 C3 A3  - F
  [130.81, 196.00, 329.63],   // C3 G3 E4  - C
  [98.00, 146.83, 246.94],    // G2 D3 B3  - G
];
export const AUDIO_MOTIF_LEVEL = 0.13;      // one motif note, at its daytime loudness
export const AUDIO_MOTIF_SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
// ^ A minor pentatonic over two octaves (A3 C4 D4 E4 G4 A4 C5 D5): no semitone rubs, so any two of
//   these notes played together are consonant.
export const AUDIO_MOTIF_GAP_MIN = 3.5;     // shortest quiet between two motif notes, in seconds
export const AUDIO_MOTIF_GAP_MAX = 8.5;     // longest quiet: sparse, varied, never a four-bar loop
export const AUDIO_MOTIF_ATTACK = 0.09;     // seconds: soft enough to arrive rather than to strike
export const AUDIO_MOTIF_DURATION = 2.6;    // seconds a motif note rings before it is gone
export const AUDIO_MOTIF_PAIR_CHANCE = 0.35;// how often a second note sounds with the first
export const AUDIO_MOTIF_PAIR_STEP = 2;     // how far up the scale that second note sits
export const AUDIO_MOTIF_PAIR_LEVEL = 0.6;  // and how loud it is against the first, so it is a breath
export const AUDIO_MOTIF_STEP_MAX = 3;      // how far the walk may move in the scale at one note
export const AUDIO_MOTIF_NIGHT_GAP = 1.8;   // gaps stretch by this much at night: sparser after dark
export const AUDIO_MOTIF_NIGHT_PITCH = 0.5; // notes drop an octave at night...
export const AUDIO_MOTIF_NIGHT_BELOW = 0.5; // ...once dayness falls below this: cosier, lower, quieter
export const AUDIO_MOTIF_NIGHT_LEVEL = 0.55;// night notes are this fraction of their day loudness
// Fixed, like PROP_SEED: the tune is written down rather than drawn, so it is the same every load.
export const AUDIO_MOTIF_SEED = 20279;

export const AUDIO_PLANT_THUD_HZ = 200;     // Hz: the low-pass corner on the pat of soil a seed lands in
export const AUDIO_PLANT_THUD_Q = 0.8;      // a soft shoulder, so the pat is a thud and not a click
export const AUDIO_PLANT_THUD_LEVEL = 0.15; // how loud that pat is
export const AUDIO_PLANT_THUD_DURATION = 0.22;  // seconds it lasts: short and earthy
export const AUDIO_PLANT_THUD_ATTACK = 0.006;   // a quick attack, because a pat is a landing not a note
export const AUDIO_PLANT_NOTE = 82.41;      // Hz E2: the soft tone under the pat, the weight of the seed
export const AUDIO_PLANT_NOTE_LEVEL = 0.12;
export const AUDIO_PLANT_NOTE_DURATION = 0.35;
export const AUDIO_PLANT_NOTE_ATTACK = 0.01;

export const AUDIO_PICK_NOTES = [880.00, 1174.66];  // A5 D6: a small bright two-note pluck, rising
export const AUDIO_PICK_LEVEL = 0.14;
export const AUDIO_PICK_STEP = 0.08;        // seconds between the two plucks
export const AUDIO_PICK_DURATION = 0.42;    // short, so it reads as picked rather than chimed
export const AUDIO_PICK_ATTACK = 0.006;

export const AUDIO_COIN_NOTES = [1046.5, 1568.0];  // C6 G6: the soft clink of a purchase, rising
export const AUDIO_COIN_LEVEL = 0.13;
export const AUDIO_COIN_STEP = 0.055;       // the two clinks are close together, like a coin on a counter
export const AUDIO_COIN_DURATION = 0.34;
export const AUDIO_COIN_ATTACK = 0.005;
// A sale is the same clink played the other way round and a whole tone lower (0.8909 = down two
// semitones), so the two are told apart with the eyes shut: buying rises, selling falls.
export const AUDIO_SELL_SHIFT = 0.8909;

export const AUDIO_WHISTLE_NOTES = [329.63, 392.00];  // E4 G4: the sky train's gentle two-note whistle
export const AUDIO_WHISTLE_LEVEL = 0.11;    // quiet, because the train is far away
export const AUDIO_WHISTLE_GAP = 0.34;      // seconds between its two notes
export const AUDIO_WHISTLE_DURATION = 1.0;  // how long each note holds
export const AUDIO_WHISTLE_ATTACK = 0.12;   // slides in like a whistle, not a blip
export const AUDIO_WHISTLE_CUTOFF = 900;    // Hz: a low-pass that keeps only the low part, so it is distant
export const AUDIO_WHISTLE_Q = 0.7;

export const AUDIO_CREAK_LEVEL = 0.09;      // the turning stone, at its loudest
export const AUDIO_CREAK_HZ = 170;          // Hz: the centre of the narrow noise band the creak is made of
export const AUDIO_CREAK_Q = 7;             // narrow, so it grinds rather than hisses
export const AUDIO_CREAK_WOBBLE_HZ = 0.6;   // how fast the band's centre wanders while the island turns
export const AUDIO_CREAK_WOBBLE_DEPTH = 40; // Hz either side it wanders: the stone sounds worked, not fixed
export const AUDIO_CREAK_RAMP = 0.12;       // seconds constant on the fade in and out, so it never clicks
