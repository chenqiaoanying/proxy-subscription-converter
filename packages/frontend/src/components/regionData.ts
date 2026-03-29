export interface RegionDefinition {
    code: string
    label: string
    keywords: string[]
}

// prettier-ignore
export const REGIONS: RegionDefinition[] = [
    { code: 'HK', label: '香港 Hong Kong',         keywords: ['HK', 'hk', '港', '香港', 'HongKong', 'Hongkong', 'Hong Kong', 'HONGKONG'] },
    { code: 'TW', label: '台湾 Taiwan',            keywords: ['TW', 'tw', '台湾', '台灣', 'Taiwan', 'taiwan', 'TAIWAN'] },
    { code: 'JP', label: '日本 Japan',             keywords: ['JP', 'jp', '日本', 'Japan', 'japan', 'JAPAN', 'Tokyo', 'Osaka'] },
    { code: 'SG', label: '新加坡 Singapore',       keywords: ['SG', 'sg', '新加坡', 'Singapore', 'singapore', 'SINGAPORE'] },
    { code: 'US', label: '美国 US',                keywords: ['US', 'us', '美国', '美', 'United States', 'UnitedStates', 'America', 'america', 'AMERICA'] },
    { code: 'UK', label: '英国 UK',                keywords: ['UK', 'uk', '英国', '英', 'United Kingdom', 'Britain', 'britain', 'BRITAIN'] },
    { code: 'DE', label: '德国 Germany',           keywords: ['DE', 'de', '德国', '德', 'Germany', 'germany', 'GERMANY'] },
    { code: 'FR', label: '法国 France',            keywords: ['FR', 'fr', '法国', '法', 'France', 'france', 'FRANCE'] },
    { code: 'KR', label: '韩国 Korea',             keywords: ['KR', 'kr', '韩国', '韓國', 'Korea', 'korea', 'KOREA', 'Seoul'] },
    { code: 'IN', label: '印度 India',             keywords: ['IN', 'in', '印度', 'India', 'india', 'INDIA'] },
    { code: 'CA', label: '加拿大 Canada',          keywords: ['CA', 'ca', '加拿大', 'Canada', 'canada', 'CANADA'] },
    { code: 'AU', label: '澳大利亚 Australia',     keywords: ['AU', 'au', '澳大利亚', '澳洲', 'Australia', 'australia', 'AUSTRALIA'] },
    { code: 'NL', label: '荷兰 Netherlands',       keywords: ['NL', 'nl', '荷兰', 'Netherlands', 'netherlands', 'NETHERLANDS'] },
    { code: 'RU', label: '俄罗斯 Russia',          keywords: ['RU', 'ru', '俄罗斯', 'Russia', 'russia', 'RUSSIA'] },
    { code: 'BR', label: '巴西 Brazil',            keywords: ['BR', 'br', '巴西', 'Brazil', 'brazil', 'BRAZIL'] },
    { code: 'TR', label: '土耳其 Turkey',          keywords: ['TR', 'tr', '土耳其', 'Turkey', 'turkey', 'TURKEY'] },
    { code: 'AE', label: '阿联酋 UAE',             keywords: ['AE', 'ae', '阿联酋', 'UAE', 'uae', 'Dubai', 'dubai', 'DUBAI'] },
    { code: 'IL', label: '以色列 Israel',          keywords: ['IL', 'il', '以色列', 'Israel', 'israel', 'ISRAEL'] },
    { code: 'TH', label: '泰国 Thailand',          keywords: ['TH', 'th', '泰国', '泰', 'Thailand', 'thailand', 'THAILAND', 'Bangkok'] },
    { code: 'VN', label: '越南 Vietnam',           keywords: ['VN', 'vn', '越南', 'Vietnam', 'vietnam', 'VIETNAM'] },
    { code: 'MY', label: '马来西亚 Malaysia',      keywords: ['MY', 'my', '马来西亚', '马来', 'Malaysia', 'malaysia', 'MALAYSIA'] },
    { code: 'ID', label: '印度尼西亚 Indonesia',   keywords: ['ID', 'id', '印度尼西亚', '印尼', 'Indonesia', 'indonesia', 'INDONESIA'] },
    { code: 'PH', label: '菲律宾 Philippines',     keywords: ['PH', 'ph', '菲律宾', 'Philippines', 'philippines', 'PHILIPPINES'] },
    { code: 'AR', label: '阿根廷 Argentina',       keywords: ['AR', 'ar', '阿根廷', 'Argentina', 'argentina', 'ARGENTINA'] },
    { code: 'MX', label: '墨西哥 Mexico',          keywords: ['MX', 'mx', '墨西哥', 'Mexico', 'mexico', 'MEXICO'] },
    { code: 'IT', label: '意大利 Italy',           keywords: ['IT', 'it', '意大利', 'Italy', 'italy', 'ITALY'] },
    { code: 'ES', label: '西班牙 Spain',           keywords: ['ES', 'es', '西班牙', 'Spain', 'spain', 'SPAIN'] },
    { code: 'CH', label: '瑞士 Switzerland',       keywords: ['CH', 'ch', '瑞士', 'Switzerland', 'switzerland', 'SWITZERLAND', 'Swiss', 'swiss'] },
    { code: 'SE', label: '瑞典 Sweden',            keywords: ['SE', 'se', '瑞典', 'Sweden', 'sweden', 'SWEDEN'] },
    { code: 'NO', label: '挪威 Norway',            keywords: ['NO', 'no', '挪威', 'Norway', 'norway', 'NORWAY'] },
    { code: 'DK', label: '丹麦 Denmark',           keywords: ['DK', 'dk', '丹麦', 'Denmark', 'denmark', 'DENMARK'] },
    { code: 'FI', label: '芬兰 Finland',           keywords: ['FI', 'fi', '芬兰', 'Finland', 'finland', 'FINLAND'] },
    { code: 'PL', label: '波兰 Poland',            keywords: ['PL', 'pl', '波兰', 'Poland', 'poland', 'POLAND'] },
    { code: 'UA', label: '乌克兰 Ukraine',         keywords: ['UA', 'ua', '乌克兰', 'Ukraine', 'ukraine', 'UKRAINE'] },
    { code: 'NZ', label: '新西兰 New Zealand',     keywords: ['NZ', 'nz', '新西兰', 'New Zealand', 'NewZealand', 'newzealand', 'NEWZEALAND'] },
    { code: 'ZA', label: '南非 South Africa',      keywords: ['ZA', 'za', '南非', 'South Africa', 'SouthAfrica', 'southafrica', 'SOUTHAFRICA'] },
]
