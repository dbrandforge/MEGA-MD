// Curated Culture Trivia expansion: global traditions, heritage, performance and material culture.
const CULTURE_SOURCES = {
  "ich": "https://ich.unesco.org/en/lists?type=00002",
  "nigeria": "https://ich.unesco.org/en/state/nigeria-NG?info=elements-on-the-lists",
  "whc": "https://whc.unesco.org/en/list/",
  "met": "https://www.metmuseum.org/toah/",
  "vam": "https://www.vam.ac.uk/collections",
  "si": "https://africa.si.edu/",
  "unesco": "https://www.unesco.org/en/culture"
};
const CULTURE_ROWS = {
  "easy": [
    [
      "Which traditional Japanese garment is commonly worn for formal ceremonies?",
      "Kimono",
      [
        "Hanbok",
        "Sari",
        "Cheongsam"
      ],
      "ich"
    ],
    [
      "What is the traditional Korean outfit commonly called?",
      "Hanbok",
      [
        "Kimono",
        "Sari",
        "Kaftan"
      ],
      "ich"
    ],
    [
      "The sari is a traditional garment most closely associated with which country?",
      "India",
      [
        "Japan",
        "Thailand",
        "Mongolia"
      ],
      "ich"
    ],
    [
      "Kente is a woven textile strongly associated with which country?",
      "Ghana",
      [
        "Senegal",
        "Kenya",
        "Morocco"
      ],
      "ich"
    ],
    [
      "Batik is a wax-resist textile art strongly associated with which country?",
      "Indonesia",
      [
        "Scotland",
        "Peru",
        "Greece"
      ],
      "ich"
    ],
    [
      "What is the Japanese art of folding paper into shapes called?",
      "Origami",
      [
        "Shibori",
        "Ikebana",
        "Kintsugi"
      ],
      "met"
    ],
    [
      "Hula is a traditional dance form associated with which place?",
      "Hawaii",
      [
        "Sicily",
        "Bali",
        "Jamaica"
      ],
      "ich"
    ],
    [
      "The haka is a ceremonial performance tradition of which people?",
      "Māori",
      [
        "Sámi",
        "Tuareg",
        "Ainu"
      ],
      "ich"
    ],
    [
      "Flamenco is a performing art most closely associated with which Spanish region?",
      "Andalusia",
      [
        "Catalonia",
        "Galicia",
        "Basque Country"
      ],
      "ich"
    ],
    [
      "Tango is a dance and music tradition historically shared by Argentina and which neighbouring country?",
      "Uruguay",
      [
        "Chile",
        "Bolivia",
        "Paraguay"
      ],
      "ich"
    ],
    [
      "Samba is especially associated with the cultural traditions of which country?",
      "Brazil",
      [
        "Portugal",
        "Cuba",
        "Mexico"
      ],
      "ich"
    ],
    [
      "Mariachi music is a well-known cultural tradition of which country?",
      "Mexico",
      [
        "Spain",
        "Colombia",
        "Peru"
      ],
      "ich"
    ],
    [
      "Which instrument is especially associated with traditional Scottish music?",
      "Bagpipes",
      [
        "Sitar",
        "Kora",
        "Balafon"
      ],
      "ich"
    ],
    [
      "Tartan patterns are strongly associated with the traditional dress and clans of which country?",
      "Scotland",
      [
        "Greece",
        "Japan",
        "Egypt"
      ],
      "vam"
    ],
    [
      "Diwali, widely known as the festival of lights, is especially associated with which country?",
      "India",
      [
        "Thailand",
        "Japan",
        "Vietnam"
      ],
      "ich"
    ],
    [
      "Holi is a spring festival widely celebrated in which country?",
      "India",
      [
        "China",
        "Cambodia",
        "Laos"
      ],
      "ich"
    ],
    [
      "Songkran, marked by water celebrations, is the traditional New Year festival of which country?",
      "Thailand",
      [
        "Nepal",
        "South Korea",
        "Malaysia"
      ],
      "ich"
    ],
    [
      "Oktoberfest is an annual folk festival that originated in which German city?",
      "Munich",
      [
        "Berlin",
        "Cologne",
        "Hamburg"
      ],
      "ich"
    ],
    [
      "La Tomatina, the famous tomato-throwing festival, takes place in which country?",
      "Spain",
      [
        "Italy",
        "Portugal",
        "France"
      ],
      "ich"
    ],
    [
      "The famous masked Carnival of Venice takes place in which country?",
      "Italy",
      [
        "Austria",
        "Belgium",
        "Croatia"
      ],
      "ich"
    ],
    [
      "Día de los Muertos, or Day of the Dead, is a cultural celebration strongly associated with which country?",
      "Mexico",
      [
        "Brazil",
        "Argentina",
        "Cuba"
      ],
      "ich"
    ],
    [
      "Nowruz marks the traditional New Year in Persian and several neighbouring cultural traditions; which season does it welcome?",
      "Spring",
      [
        "Summer",
        "Autumn",
        "Winter"
      ],
      "ich"
    ],
    [
      "Midsummer celebrations are especially prominent in which Nordic country?",
      "Sweden",
      [
        "Iceland",
        "Ireland",
        "Portugal"
      ],
      "ich"
    ],
    [
      "Junkanoo is a major parade and festival tradition of which Caribbean country?",
      "The Bahamas",
      [
        "Barbados",
        "Grenada",
        "Dominica"
      ],
      "ich"
    ],
    [
      "Fado is a traditional urban music genre associated with which country?",
      "Portugal",
      [
        "Greece",
        "Norway",
        "Austria"
      ],
      "ich"
    ],
    [
      "Bossa nova emerged as a popular music style in which country?",
      "Brazil",
      [
        "Cuba",
        "Argentina",
        "Mexico"
      ],
      "ich"
    ],
    [
      "Gamelan is a traditional musical ensemble most closely associated with which country?",
      "Indonesia",
      [
        "India",
        "Japan",
        "Mongolia"
      ],
      "ich"
    ],
    [
      "The sitar is a long-necked string instrument strongly associated with which musical tradition?",
      "Indian classical music",
      [
        "Andalusian flamenco",
        "Scottish folk music",
        "Brazilian samba"
      ],
      "met"
    ],
    [
      "The djembe is a goblet-shaped drum associated with communities across which region?",
      "West Africa",
      [
        "Northern Europe",
        "East Asia",
        "The Caribbean"
      ],
      "ich"
    ],
    [
      "The kora is a plucked string instrument associated with traditional music in which region?",
      "West Africa",
      [
        "Central Europe",
        "East Asia",
        "The Andes"
      ],
      "ich"
    ],
    [
      "The didgeridoo is a wind instrument associated with the Indigenous peoples of which country?",
      "Australia",
      [
        "Canada",
        "New Zealand",
        "South Africa"
      ],
      "si"
    ],
    [
      "Taiko refers to traditional Japanese performance using which instrument family?",
      "Drums",
      [
        "Flutes",
        "Harps",
        "Bells"
      ],
      "ich"
    ],
    [
      "Bharatanatyam is a classical dance tradition that originated in which Indian state?",
      "Tamil Nadu",
      [
        "Punjab",
        "Gujarat",
        "Assam"
      ],
      "ich"
    ],
    [
      "Bhangra is a lively music and dance tradition originating in which region?",
      "Punjab",
      [
        "Kerala",
        "Bengal",
        "Rajasthan"
      ],
      "ich"
    ],
    [
      "Garba is a group dance tradition especially associated with which Indian state?",
      "Gujarat",
      [
        "Goa",
        "Sikkim",
        "Himachal Pradesh"
      ],
      "ich"
    ],
    [
      "Pysanka is the Ukrainian tradition of decorating what?",
      "Eggs",
      [
        "Ceramic plates",
        "Wooden masks",
        "Silk fans"
      ],
      "ich"
    ],
    [
      "Tinikling is a traditional dance from which country?",
      "The Philippines",
      [
        "Indonesia",
        "Thailand",
        "Cambodia"
      ],
      "ich"
    ],
    [
      "A ceilidh is a traditional social gathering featuring music and dancing, especially associated with which places?",
      "Scotland and Ireland",
      [
        "Greece and Cyprus",
        "Japan and Korea",
        "Egypt and Sudan"
      ],
      "ich"
    ],
    [
      "A souk is traditionally what kind of place in many Middle Eastern and North African towns?",
      "A market",
      [
        "A palace",
        "A school",
        "A theatre"
      ],
      "ich"
    ],
    [
      "A pagoda is best described as what kind of structure found in several East and Southeast Asian traditions?",
      "A tiered tower",
      [
        "A stone circle",
        "A desert tent",
        "A Roman arena"
      ],
      "whc"
    ],
    [
      "A minaret is a tower traditionally associated with which type of building?",
      "A mosque",
      [
        "A theatre",
        "A fortress",
        "A railway station"
      ],
      "unesco"
    ],
    [
      "In many West African societies, a griot is traditionally known for which role?",
      "Storyteller and keeper of oral history",
      [
        "Shipbuilder",
        "Metal miner",
        "Court architect"
      ],
      "ich"
    ],
    [
      "Which Brazilian city is internationally famous for its large annual Carnival celebrations?",
      "Rio de Janeiro",
      [
        "Brasília",
        "Manaus",
        "Curitiba"
      ],
      "ich"
    ],
    [
      "The ancient rock-cut city of Petra is located in which modern country?",
      "Jordan",
      [
        "Lebanon",
        "Iraq",
        "Egypt"
      ],
      "whc"
    ],
    [
      "The Taj Mahal, a celebrated Mughal-era monument, is located in which country?",
      "India",
      [
        "Pakistan",
        "Bangladesh",
        "Nepal"
      ],
      "whc"
    ],
    [
      "The Acropolis, including the Parthenon, stands in which city?",
      "Athens",
      [
        "Rome",
        "Istanbul",
        "Alexandria"
      ],
      "whc"
    ]
  ],
  "normal": [
    [
      "Adinkra symbols are especially associated with the Akan peoples of which country?",
      "Ghana",
      [
        "Ethiopia",
        "Morocco",
        "Namibia"
      ],
      "ich"
    ],
    [
      "The Akan concept represented by the Sankofa symbol encourages people to do what?",
      "Return to the past and retrieve what is valuable",
      [
        "Reject all inherited knowledge",
        "Travel only toward the future",
        "Avoid learning from elders"
      ],
      "ich"
    ],
    [
      "Aso-oke is a handwoven textile traditionally associated with which Nigerian people?",
      "Yoruba",
      [
        "Kanuri",
        "Tiv",
        "Ijaw"
      ],
      "nigeria"
    ],
    [
      "Adire is a traditional resist-dyed textile art associated with which Nigerian cultural group?",
      "Yoruba",
      [
        "Igbo",
        "Efik",
        "Nupe"
      ],
      "nigeria"
    ],
    [
      "Akwete weaving is named after a town in which Nigerian state?",
      "Abia",
      [
        "Kebbi",
        "Ekiti",
        "Borno"
      ],
      "nigeria"
    ],
    [
      "Nsibidi is a system of graphic signs historically associated with communities in which Nigerian region?",
      "The Cross River region",
      [
        "The Sokoto region",
        "The Niger Delta west of the Benin River",
        "The Lake Chad basin"
      ],
      "nigeria"
    ],
    [
      "Egungun masquerade traditions among the Yoruba are closely connected with the remembrance of whom?",
      "Ancestors",
      [
        "Sea traders",
        "Royal cavalry horses",
        "Harvest merchants"
      ],
      "nigeria"
    ],
    [
      "The Ijele masquerade is associated with which broad Nigerian cultural group?",
      "Igbo",
      [
        "Hausa",
        "Fulani",
        "Ijaw"
      ],
      "nigeria"
    ],
    [
      "Gelede is a performance tradition associated with Yoruba-Nago communities in Nigeria and which neighbouring countries?",
      "Benin and Togo",
      [
        "Niger and Chad",
        "Cameroon and Gabon",
        "Ghana and Côte d’Ivoire"
      ],
      "ich"
    ],
    [
      "Kwagh-Hir is a theatrical performance tradition of which Nigerian people?",
      "Tiv",
      [
        "Edo",
        "Ibibio",
        "Kanuri"
      ],
      "nigeria"
    ],
    [
      "The Ifa divination system is rooted in the traditional knowledge and religious culture of which people?",
      "Yoruba",
      [
        "Maasai",
        "Akan",
        "Berber"
      ],
      "ich"
    ],
    [
      "The Durbar in Kano is especially known for ceremonial displays involving what?",
      "Horses and mounted processions",
      [
        "Sailing boats",
        "Ice sculptures",
        "การแข่งขัน rowing"
      ],
      "nigeria"
    ],
    [
      "The Sango Festival is particularly associated with which Nigerian city and cultural centre?",
      "Oyo",
      [
        "Kano",
        "Calabar",
        "Owerri"
      ],
      "nigeria"
    ],
    [
      "The Argungu International Fishing and Cultural Festival is associated with which Nigerian state?",
      "Kebbi",
      [
        "Enugu",
        "Ogun",
        "Cross River"
      ],
      "nigeria"
    ],
    [
      "Timkat is an Ethiopian celebration associated with which Christian feast?",
      "Epiphany",
      [
        "Pentecost",
        "Palm Sunday",
        "All Saints’ Day"
      ],
      "ich"
    ],
    [
      "Meskel is an Ethiopian religious-cultural festival commemorating the discovery of which object?",
      "The True Cross",
      [
        "The Ark of the Covenant",
        "A royal crown",
        "An ancient manuscript"
      ],
      "ich"
    ],
    [
      "The Gerewol courtship festival is associated with which pastoralist people of the Sahel?",
      "Wodaabe",
      [
        "Maasai",
        "Tuareg",
        "Sámi"
      ],
      "ich"
    ],
    [
      "Famadihana, sometimes called the turning of the bones, is a funerary tradition found in parts of which country?",
      "Madagascar",
      [
        "Morocco",
        "Ghana",
        "Eritrea"
      ],
      "ich"
    ],
    [
      "Umhlanga, often called the Reed Dance, is a major annual cultural event in which country?",
      "Eswatini",
      [
        "Botswana",
        "Lesotho",
        "Namibia"
      ],
      "ich"
    ],
    [
      "The Maasai communities are historically associated with which two East African countries?",
      "Kenya and Tanzania",
      [
        "Ghana and Togo",
        "Angola and Zambia",
        "Senegal and Mali"
      ],
      "unesco"
    ],
    [
      "The Tuareg are a traditionally nomadic people whose communities span the Sahara and which broader region?",
      "The Sahel",
      [
        "The Amazon basin",
        "The Baltic coast",
        "The Himalayas"
      ],
      "unesco"
    ],
    [
      "Amazigh communities are Indigenous to which broad region?",
      "North Africa",
      [
        "The Andes",
        "Southeast Asia",
        "Northern Europe"
      ],
      "unesco"
    ],
    [
      "Swahili developed as a major language and cultural tradition along which coastline?",
      "The East African coast",
      [
        "The Atlantic coast of West Africa",
        "The Mediterranean coast of Spain",
        "The Pacific coast of South America"
      ],
      "unesco"
    ],
    [
      "The Mandé griot tradition is especially associated with the transmission of what?",
      "Genealogy, history and oral poetry",
      [
        "Ship navigation charts",
        "Metalworking formulas",
        "Agricultural tax records"
      ],
      "ich"
    ],
    [
      "Bògòlanfini, often called mud cloth, is a textile tradition associated with which country?",
      "Mali",
      [
        "Tunisia",
        "Ethiopia",
        "Angola"
      ],
      "ich"
    ],
    [
      "Pattachitra painting is especially associated with which Indian state?",
      "Odisha",
      [
        "Punjab",
        "Gujarat",
        "Kerala"
      ],
      "met"
    ],
    [
      "Madhubani painting is associated with the Mithila cultural region, centred largely in which Indian state?",
      "Bihar",
      [
        "Goa",
        "Maharashtra",
        "Tamil Nadu"
      ],
      "met"
    ],
    [
      "Warli painting is a traditional art form associated with communities in which Indian state?",
      "Maharashtra",
      [
        "Assam",
        "Rajasthan",
        "Haryana"
      ],
      "met"
    ],
    [
      "In ikat textile production, when are yarns dyed to create patterns?",
      "Before they are woven",
      [
        "After the finished cloth is embroidered",
        "Only after the cloth is bleached",
        "After the fabric is cut into garments"
      ],
      "vam"
    ],
    [
      "Shibori is a Japanese textile tradition based on which process?",
      "Resist dyeing",
      [
        "Metal engraving",
        "Wood carving",
        "Glass blowing"
      ],
      "vam"
    ],
    [
      "Kintsugi is the Japanese craft of repairing broken ceramics using lacquer and what decorative material?",
      "Gold or other metallic powder",
      [
        "Crushed seashells",
        "Woven grass",
        "Coloured sand"
      ],
      "met"
    ],
    [
      "Sashiko is a Japanese textile technique best known for what?",
      "Decorative reinforcement stitching",
      [
        "Wax-resist dyeing",
        "Paper folding",
        "Silk-screen printing"
      ],
      "vam"
    ],
    [
      "Wayang kulit is a traditional performance form from Indonesia that uses what?",
      "Leather shadow puppets",
      [
        "Marble statues",
        "Paper lanterns",
        "Metal masks"
      ],
      "ich"
    ],
    [
      "Bunraku is a traditional Japanese form of what?",
      "Puppet theatre",
      [
        "Opera singing",
        "Sword dancing",
        "Street acrobatics"
      ],
      "ich"
    ],
    [
      "Pansori is a Korean musical storytelling tradition typically performed by a singer and what accompanying musician?",
      "A drummer",
      [
        "A harpist",
        "A flautist",
        "A violin quartet"
      ],
      "ich"
    ],
    [
      "Kathakali is a classical dance-drama tradition from which Indian state?",
      "Kerala",
      [
        "Bihar",
        "Punjab",
        "Gujarat"
      ],
      "ich"
    ],
    [
      "Odissi is a classical dance tradition originating in which Indian state?",
      "Odisha",
      [
        "Maharashtra",
        "Assam",
        "Haryana"
      ],
      "ich"
    ],
    [
      "Noh is a classical form of theatre that developed in which country?",
      "Japan",
      [
        "China",
        "Thailand",
        "Vietnam"
      ],
      "ich"
    ],
    [
      "Rebetiko is an urban popular music tradition historically associated with which country?",
      "Greece",
      [
        "Portugal",
        "Norway",
        "Ireland"
      ],
      "ich"
    ],
    [
      "Morna is a musical tradition strongly associated with which island country?",
      "Cabo Verde",
      [
        "Mauritius",
        "Seychelles",
        "Comoros"
      ],
      "ich"
    ],
    [
      "Maloya is a music and dance tradition associated with which Indian Ocean island?",
      "Réunion",
      [
        "Madagascar",
        "Sri Lanka",
        "Zanzibar"
      ],
      "ich"
    ],
    [
      "Sega is a music and dance tradition associated with Mauritius and which nearby island?",
      "Rodrigues",
      [
        "Borneo",
        "Crete",
        "Hokkaido"
      ],
      "ich"
    ],
    [
      "Taarab music developed around the cultural world of the Swahili coast, especially which island?",
      "Zanzibar",
      [
        "Bali",
        "Cyprus",
        "Sicily"
      ],
      "ich"
    ],
    [
      "Kochari is a traditional group dance associated with which country?",
      "Armenia",
      [
        "Portugal",
        "Japan",
        "Ghana"
      ],
      "ich"
    ],
    [
      "Zaouli is a popular music and dance tradition of the Guro communities in which country?",
      "Côte d’Ivoire",
      [
        "Mali",
        "Benin",
        "Cameroon"
      ],
      "ich"
    ],
    [
      "Kumbh Mela is a major pilgrimage gathering held in which country?",
      "India",
      [
        "Nepal",
        "Sri Lanka",
        "Myanmar"
      ],
      "ich"
    ]
  ]
};
const makePositions = counts => {
  const positions = [];
  for (let round = 0; round < Math.max(...counts); round++) {
    for (let position = 0; position < 4; position++) if (round < counts[position]) positions.push(position);
  }
  return positions;
};
const makeLevel = (rows, difficulty, start, counts) => {
  const positions = makePositions(counts);
  if (rows.length !== positions.length) throw new Error(`Invalid ${difficulty} Culture Trivia row count`);
  return rows.map(([question, correct, distractors, source], index) => {
    const answer = positions[index];
    const options = distractors.slice();
    options.splice(answer, 0, correct);
    return {
      id: `cu${String(start + index).padStart(3, '0')}`, category: 'culture', difficulty,
      question, options, answer, reviewedAt: '2026-11-06', source: CULTURE_SOURCES[source]
    };
  });
};
export const CULTURE_TRIVIA = [
  ...makeLevel(CULTURE_ROWS.easy, 'easy', 1, [10, 12, 12, 12]),
  ...makeLevel(CULTURE_ROWS.normal, 'normal', 47, [10, 12, 12, 12])
];
