// F1 25 Team Color Themes
// Based on exact in-game broadcast color codes

export const F1_TEAMS = [
  {
    id: 'mercedes',
    name: 'Mercedes',
    fullName: 'Mercedes AMG Petronas',
    primary: '#04BFAD',    // Petronas Turquoise (4,191,173)
    secondary: '#979DA6',  // Silver (151,157,166)
    accent: '#04BFAD',
    bg: '#0a0a0f',
    card: '#12131a',
    border: '#1e2028',
  },
  {
    id: 'redbull',
    name: 'Red Bull',
    fullName: 'Oracle Red Bull Racing',
    primary: '#23326A',    // Red Bull Main Blue (35,50,106)
    secondary: '#FED700',  // Red Bull Yellow (254,215,0)
    accent: '#4781D7',     // Red Bull Broadcast Colour (71,129,215)
    bg: '#08091a',
    card: '#0f1120',
    border: '#1a1e38',
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    fullName: 'Scuderia Ferrari HP',
    primary: '#ED1131',    // Ferrari Broadcast Colour (237,17,49)
    secondary: '#FFEB00',  // Ferrari Yellow (255,235,0)
    accent: '#ED1131',
    bg: '#0f0a0a',
    card: '#1a1012',
    border: '#2d1a1e',
  },
  {
    id: 'mclaren',
    name: 'McLaren',
    fullName: 'McLaren F1 Team',
    primary: '#FF8000',    // McLaren Main Papaya (255,128,0)
    secondary: '#0B617C',  // Allwyn Blue (11,97,124)
    accent: '#F47600',     // McLaren Broadcast Colour (244,118,0)
    bg: '#0f0c0a',
    card: '#1a1510',
    border: '#2d2218',
  },
  {
    id: 'astonmartin',
    name: 'Aston Martin',
    fullName: 'Aston Martin Aramco',
    primary: '#229971',    // AMR Broadcast colour (34,153,113)
    secondary: '#CEDC00',  // AMR Trim Green/Yellow (206,220,0)
    accent: '#008085',     // AMR Main Green (0,128,133) - adjusted for dark bg
    bg: '#0a0f0d',
    card: '#101a16',
    border: '#1a2d25',
  },
  {
    id: 'alpine',
    name: 'Alpine',
    fullName: 'BWT Alpine F1 Team',
    primary: '#006FBA',    // Alpine Main Blue (0,111,186)
    secondary: '#FF89BD',  // Alpine BWT Pink (255,137,189)
    accent: '#00A1E8',     // Alpine Broadcast Colour (0,161,232)
    bg: '#0a0c14',
    card: '#10141e',
    border: '#1a2038',
  },
  {
    id: 'williams',
    name: 'Williams',
    fullName: 'Williams Racing',
    primary: '#1868DB',    // Williams Blue
    secondary: '#00A3E0',  // Williams Light Blue
    accent: '#1868DB',
    bg: '#0a0a12',
    card: '#10121a',
    border: '#1a1e30',
  },
  {
    id: 'rb',
    name: 'RB',
    fullName: 'Visa Cash App RB',
    primary: '#6692FF',    // RB Blue
    secondary: '#FFFFFF',
    accent: '#6692FF',
    bg: '#0a0c14',
    card: '#10141e',
    border: '#1e2438',
  },
  {
    id: 'sauber',
    name: 'Kick Sauber',
    fullName: 'Stake F1 Team Kick Sauber',
    primary: '#52E252',    // Kick Sauber Broadcast Colour (82,226,82)
    secondary: '#000000',
    accent: '#52FB18',     // Kick Sauber Main Green (82,251,24)
    bg: '#0a0f0a',
    card: '#101a10',
    border: '#1a2d1a',
  },
  {
    id: 'haas',
    name: 'Haas',
    fullName: 'MoneyGram Haas F1 Team',
    primary: '#9C9FA2',    // Haas Broadcast Colour (156,159,162)
    secondary: '#EE2E24',  // Haas Moneygram Red (238,46,36)
    accent: '#B6BABD',
    bg: '#0c0c0e',
    card: '#141418',
    border: '#222228',
  },
]

export const DEFAULT_THEME = 'mercedes'

export function getTeamTheme(teamId) {
  return F1_TEAMS.find(t => t.id === teamId) || F1_TEAMS[0]
}
