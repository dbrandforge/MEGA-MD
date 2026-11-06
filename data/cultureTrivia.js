// Curated Culture Trivia expansion: global traditions, heritage, performance and material culture.
const CULTURE_SOURCES = {
  "ich": "https://ich.unesco.org/en/lists?type=00002",
  "nigeria": "https://ich.unesco.org/en/state/nigeria-NG?info=elements-on-the-lists",
  "whc": "https://whc.unesco.org/en/list/",
  "met": "https://www.metmuseum.org/toah/",
  "bm": "https://www.britishmuseum.org/collection",
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
  ],
  "hard": [
    [
      "In which year was Nigeria’s Ijele masquerade inscribed on UNESCO’s Representative List of Intangible Cultural Heritage?",
      "2009",
      [
        "2003",
        "2013",
        "2019"
      ],
      "nigeria"
    ],
    [
      "The Gelede tradition is practised by Yoruba-Nago communities across Benin, Nigeria and which other country?",
      "Togo",
      [
        "Ghana",
        "Niger",
        "Cameroon"
      ],
      "ich"
    ],
    [
      "Kwagh-Hir, a Tiv theatrical performance tradition, was inscribed by UNESCO in which year?",
      "2019",
      [
        "2008",
        "2014",
        "2024"
      ],
      "nigeria"
    ],
    [
      "In which year was the Argungu international fishing and cultural festival inscribed on UNESCO’s Intangible Cultural Heritage list?",
      "2016",
      [
        "2009",
        "2012",
        "2021"
      ],
      "nigeria"
    ],
    [
      "The Sango Festival of Oyo was added to UNESCO’s Representative List in which year?",
      "2023",
      [
        "2016",
        "2019",
        "2024"
      ],
      "nigeria"
    ],
    [
      "Durbar in Kano was inscribed on UNESCO’s Representative List of Intangible Cultural Heritage in which year?",
      "2024",
      [
        "2018",
        "2020",
        "2022"
      ],
      "nigeria"
    ],
    [
      "Nigeria’s inscription for midwifery knowledge, skills and practices was part of a multinational UNESCO entry in which year?",
      "2023",
      [
        "2015",
        "2019",
        "2024"
      ],
      "nigeria"
    ],
    [
      "Traditional craftsmanship of Kente was inscribed by UNESCO for which country in 2024?",
      "Ghana",
      [
        "Nigeria",
        "Côte d’Ivoire",
        "Togo"
      ],
      "ich"
    ],
    [
      "The Manden Charter, an oral tradition associated with the founding of the Mali Empire, is linked to which present-day country?",
      "Mali",
      [
        "Guinea-Bissau",
        "Niger",
        "Burkina Faso"
      ],
      "ich"
    ],
    [
      "Gule Wamkulu is a masked dance tradition of the Chewa people in Malawi and which two neighbouring countries?",
      "Mozambique and Zambia",
      [
        "Kenya and Tanzania",
        "Ghana and Togo",
        "Benin and Nigeria"
      ],
      "ich"
    ],
    [
      "Vimbuza is a healing dance tradition associated with the Tumbuka people, especially in which country?",
      "Malawi",
      [
        "Botswana",
        "Senegal",
        "Ethiopia"
      ],
      "ich"
    ],
    [
      "Chopi Timbila is a musical tradition built around orchestras of wooden xylophones in which country?",
      "Mozambique",
      [
        "Angola",
        "Gabon",
        "Rwanda"
      ],
      "ich"
    ],
    [
      "Zaouli, known for its distinctive mask and dance, is associated with the Guro communities of which country?",
      "Côte d’Ivoire",
      [
        "Ghana",
        "Guinea",
        "Cameroon"
      ],
      "ich"
    ],
    [
      "The Sosso-Bala, a sacred balafon tradition, is associated with which country?",
      "Guinea",
      [
        "Mali",
        "Benin",
        "Niger"
      ],
      "ich"
    ],
    [
      "Tango was jointly inscribed on UNESCO’s Intangible Cultural Heritage list by Argentina and which country?",
      "Uruguay",
      [
        "Chile",
        "Paraguay",
        "Bolivia"
      ],
      "ich"
    ],
    [
      "Samba de Roda, a circle-based music and dance tradition, originated in which Brazilian region?",
      "The Recôncavo of Bahia",
      [
        "The Amazon basin",
        "The Pantanal",
        "The southern pampas"
      ],
      "ich"
    ],
    [
      "Rumba, recognised by UNESCO as an expression of Cuban identity, is associated with which country?",
      "Cuba",
      [
        "Puerto Rico",
        "Dominican Republic",
        "Jamaica"
      ],
      "ich"
    ],
    [
      "The Cocolo dance drama tradition is associated with Afro-descendant communities in which country?",
      "Dominican Republic",
      [
        "Haiti",
        "Cuba",
        "Trinidad and Tobago"
      ],
      "ich"
    ],
    [
      "The ritual ceremony of the Voladores, involving performers descending from a pole, is associated with which country?",
      "Mexico",
      [
        "Peru",
        "Guatemala",
        "Ecuador"
      ],
      "ich"
    ],
    [
      "Dabkeh, a traditional group dance, is inscribed for which territory?",
      "Palestine",
      [
        "Jordan",
        "Lebanon",
        "Cyprus"
      ],
      "ich"
    ],
    [
      "Tbourida is a Moroccan equestrian performance involving coordinated displays by mounted riders; what are the riders commonly called?",
      "Tbourida teams or sorbas",
      [
        "Griots",
        "Muezzins",
        "Maalems"
      ],
      "ich"
    ],
    [
      "Hiragasy is a popular performing art combining music, dance and oratory in which country?",
      "Madagascar",
      [
        "Mauritius",
        "Seychelles",
        "Comoros"
      ],
      "ich"
    ],
    [
      "Moutya, a dance and music tradition shaped by the history of enslaved people, is associated with which country?",
      "Seychelles",
      [
        "Mauritius",
        "Maldives",
        "Sri Lanka"
      ],
      "ich"
    ],
    [
      "Furyu-odori refers to a group of ritual folk dances inscribed by which country?",
      "Japan",
      [
        "China",
        "Republic of Korea",
        "Mongolia"
      ],
      "ich"
    ],
    [
      "Khaen music of the Lao people is built around which instrument?",
      "A free-reed mouth organ",
      [
        "A double-headed frame drum",
        "A bowed spike fiddle",
        "A long-necked lute"
      ],
      "ich"
    ],
    [
      "Nora is a traditional dance-drama form associated with southern which country?",
      "Thailand",
      [
        "Vietnam",
        "Cambodia",
        "Myanmar"
      ],
      "ich"
    ],
    [
      "Tibetan opera is commonly known by what name in its own tradition?",
      "Lhamo",
      [
        "Kabuki",
        "Pansori",
        "Wayang"
      ],
      "ich"
    ],
    [
      "Katta Ashula is a traditional large-scale vocal genre associated with which country?",
      "Uzbekistan",
      [
        "Armenia",
        "Georgia",
        "Azerbaijan"
      ],
      "ich"
    ],
    [
      "Duduk and its music, a UNESCO-recognised tradition, is associated with which country?",
      "Armenia",
      [
        "Türkiye",
        "Greece",
        "Bulgaria"
      ],
      "ich"
    ],
    [
      "Silbo Gomero is a whistled language developed on which Spanish island?",
      "La Gomera",
      [
        "Mallorca",
        "Tenerife",
        "Lanzarote"
      ],
      "ich"
    ],
    [
      "Mangal Shobhajatra is a festive procession marking the Bengali New Year in which country?",
      "Bangladesh",
      [
        "Nepal",
        "Bhutan",
        "Sri Lanka"
      ],
      "ich"
    ],
    [
      "Palov culture and tradition, centred on a rice dish and its social practices, is recognised for which country?",
      "Uzbekistan",
      [
        "Kazakhstan",
        "Kyrgyzstan",
        "Tajikistan"
      ],
      "ich"
    ],
    [
      "Junkanoo is a street parade tradition recognised as part of the cultural heritage of which country?",
      "The Bahamas",
      [
        "Barbados",
        "Belize",
        "Guyana"
      ],
      "ich"
    ],
    [
      "The Kumbh Mela pilgrimage rotates among sacred sites in which country?",
      "India",
      [
        "Nepal",
        "Bhutan",
        "Sri Lanka"
      ],
      "ich"
    ],
    [
      "Kankurang is an initiatory rite and masquerade tradition of Manding communities in Senegal and which country?",
      "The Gambia",
      [
        "Guinea",
        "Mali",
        "Liberia"
      ],
      "ich"
    ],
    [
      "Namsadang Nori is a traditional itinerant performance art from which country?",
      "Republic of Korea",
      [
        "Japan",
        "China",
        "Vietnam"
      ],
      "ich"
    ],
    [
      "Ramman, a religious festival and ritual theatre tradition, is practised in which Indian region?",
      "Garhwal Himalayas",
      [
        "Thar Desert",
        "Konkan Coast",
        "Deccan Plateau"
      ],
      "ich"
    ],
    [
      "Dainichido Bugaku is a traditional ritual dance tradition associated with which country?",
      "Japan",
      [
        "Republic of Korea",
        "China",
        "Thailand"
      ],
      "ich"
    ],
    [
      "Noh theatre is especially known for the use of what on selected performers?",
      "Carved masks",
      [
        "Full-body puppets",
        "Painted paper fans only",
        "Metal helmets"
      ],
      "ich"
    ],
    [
      "Kabuki theatre is widely recognised for stylised acting, elaborate costumes and what distinctive visual feature?",
      "Kumadori makeup",
      [
        "Shadow puppets",
        "Marionette strings",
        "Unmasked choral chanting"
      ],
      "ich"
    ],
    [
      "Wayang kulit performances traditionally project the silhouettes of puppets onto what?",
      "A screen",
      [
        "A painted floor",
        "A water surface",
        "A mirrored wall"
      ],
      "ich"
    ],
    [
      "Sbek Thom is a Khmer tradition of large shadow puppets made from what material?",
      "Leather",
      [
        "Bamboo paper",
        "Silk",
        "Bronze"
      ],
      "ich"
    ],
    [
      "Karagöz is a traditional shadow-puppet theatre associated with which country?",
      "Türkiye",
      [
        "Greece",
        "Egypt",
        "Iran"
      ],
      "ich"
    ],
    [
      "The traditional song-and-poetry genre pasillo is recognised as cultural heritage in which country?",
      "Ecuador",
      [
        "Paraguay",
        "Uruguay",
        "Colombia"
      ],
      "ich"
    ],
    [
      "Guarania, a musical genre created in the twentieth century, is associated with which country?",
      "Paraguay",
      [
        "Peru",
        "Bolivia",
        "Chile"
      ],
      "ich"
    ],
    [
      "The traditional music practice called Rebetiko is especially associated with urban communities in which country?",
      "Greece",
      [
        "Portugal",
        "Croatia",
        "Romania"
      ],
      "ich"
    ],
    [
      "The art of the Duduk is associated with an instrument made primarily from which tree’s wood?",
      "Apricot",
      [
        "Olive",
        "Cedar",
        "Oak"
      ],
      "ich"
    ],
    [
      "The traditional art of Tbourida recreates the coordinated charge of mounted riders using which equipment?",
      "Horses and rifles",
      [
        "Camels and bows",
        "Oxen and spears",
        "Donkeys and shields"
      ],
      "ich"
    ],
    [
      "The Guelaguetza cultural celebration is strongly associated with which Mexican state?",
      "Oaxaca",
      [
        "Yucatán",
        "Jalisco",
        "Chiapas"
      ],
      "unesco"
    ]
  ],
  "expert": [
    [
      "Who developed the N’Ko writing system in 1949 to write Manding languages?",
      "Solomana Kanté",
      [
        "Amadou Hampâté Bâ",
        "Cheikh Anta Diop",
        "Seydou Badian"
      ],
      "unesco"
    ],
    [
      "The modern Korean alphabet Hangul was promulgated in 1446 under which monarch?",
      "King Sejong",
      [
        "King Taejo",
        "King Yeongjo",
        "King Gojong"
      ],
      "ich"
    ],
    [
      "Tifinagh is a writing system used for which language family?",
      "Amazigh languages",
      [
        "Bantu languages",
        "Dravidian languages",
        "Slavic languages"
      ],
      "unesco"
    ],
    [
      "In African-language writing, the term Ajami commonly refers to the adaptation of which script?",
      "Arabic script",
      [
        "Latin script",
        "Greek script",
        "Cyrillic script"
      ],
      "unesco"
    ],
    [
      "Nüshu, a syllabic writing system historically used by women, developed in which Chinese county?",
      "Jiangyong",
      [
        "Dunhuang",
        "Lijiang",
        "Kaifeng"
      ],
      "unesco"
    ],
    [
      "The ancient Maya writing system is best classified as which type?",
      "Logosyllabic",
      [
        "Alphabetic",
        "Abjad",
        "Purely pictographic"
      ],
      "met"
    ],
    [
      "Cuneiform writing first developed in which ancient region?",
      "Sumer in Mesopotamia",
      [
        "The Indus Valley",
        "The Nile Delta",
        "The Aegean islands"
      ],
      "met"
    ],
    [
      "The Phoenician writing system was an important influence on the development of which later alphabet?",
      "Greek",
      [
        "Devanagari",
        "Hangul",
        "Ethiopic"
      ],
      "met"
    ],
    [
      "Which script is used to write Amharic and several other languages of Ethiopia?",
      "Ethiopic script",
      [
        "Tifinagh",
        "N’Ko",
        "Tibetan script"
      ],
      "unesco"
    ],
    [
      "Modern Japanese writing combines kanji with which two kana syllabaries?",
      "Hiragana and katakana",
      [
        "Hangul and hanja",
        "Pinyin and zhuyin",
        "Hanzi and bopomofo"
      ],
      "unesco"
    ],
    [
      "Which Japanese theatre scholar and performer systematised important Noh performance principles in the fifteenth century?",
      "Zeami Motokiyo",
      [
        "Izumo no Okuni",
        "Chikamatsu Monzaemon",
        "Matsuo Bashō"
      ],
      "ich"
    ],
    [
      "The early Kabuki performer traditionally credited with founding the form began performing in Kyoto around which year?",
      "1603",
      [
        "1492",
        "1707",
        "1868"
      ],
      "ich"
    ],
    [
      "In traditional Bunraku, how many puppeteers typically manipulate one principal puppet?",
      "Three",
      [
        "One",
        "Two",
        "Five"
      ],
      "ich"
    ],
    [
      "A traditional Pansori performance centres on a singer accompanied by which instrument?",
      "A barrel drum",
      [
        "A zither",
        "A bamboo flute",
        "A bowed lute"
      ],
      "ich"
    ],
    [
      "Gagaku is the traditional court music of which country?",
      "Japan",
      [
        "China",
        "Republic of Korea",
        "Vietnam"
      ],
      "ich"
    ],
    [
      "Kumiodori is a classical dance-drama tradition that developed in which Japanese island group?",
      "The Ryukyu Islands",
      [
        "The Ogasawara Islands",
        "The Kuril Islands",
        "The Izu Islands"
      ],
      "ich"
    ],
    [
      "The term Lhamo refers to which Tibetan performing-art tradition?",
      "Tibetan opera",
      [
        "Shadow puppetry",
        "Court poetry",
        "Ritual wrestling"
      ],
      "ich"
    ],
    [
      "In Wayang kulit, the puppets are traditionally crafted from which material?",
      "Leather",
      [
        "Porcelain",
        "Bronze",
        "Woven reeds"
      ],
      "ich"
    ],
    [
      "Sbek Thom differs from many small puppet forms because its figures are generally what?",
      "Large and non-articulated",
      [
        "Tiny and fully mechanical",
        "Made of glass",
        "Carried as hand puppets"
      ],
      "ich"
    ],
    [
      "Karagöz shadow theatre traditionally uses translucent puppets made from treated what?",
      "Leather",
      [
        "Silk",
        "Ceramic",
        "Bamboo"
      ],
      "ich"
    ],
    [
      "Katta Ashula is traditionally performed by several singers without which accompaniment?",
      "Instrumental accompaniment",
      [
        "A chorus",
        "Poetic text",
        "Melodic vocal lines"
      ],
      "ich"
    ],
    [
      "The khaen, central to Lao musical culture, produces sound through which mechanism?",
      "Free reeds",
      [
        "A stretched skin membrane",
        "A struck bronze plate",
        "A vibrating horsehair bow"
      ],
      "ich"
    ],
    [
      "Khoomei is a form of overtone or throat singing associated especially with which country?",
      "Mongolia",
      [
        "Nepal",
        "Bhutan",
        "Cambodia"
      ],
      "ich"
    ],
    [
      "Urtiin Duu, or long song, is a traditional musical form shared by Mongolia and which neighbouring country?",
      "China",
      [
        "Japan",
        "Russia only",
        "Kazakhstan"
      ],
      "ich"
    ],
    [
      "Radif is the repertory framework of which classical music tradition?",
      "Persian classical music",
      [
        "Andalusian flamenco",
        "Japanese gagaku",
        "Cuban rumba"
      ],
      "ich"
    ],
    [
      "The sacred Sosso-Bala balafon is traditionally kept in which Guinean village?",
      "Niagassola",
      [
        "Kankan",
        "Kindia",
        "Labé"
      ],
      "ich"
    ],
    [
      "Chopi Timbila orchestras are centred on ensembles of which instrument?",
      "Xylophones",
      [
        "Lutes",
        "Bagpipes",
        "Frame drums"
      ],
      "ich"
    ],
    [
      "Gule Wamkulu is associated with the initiation and ritual life of which southern African people?",
      "Chewa",
      [
        "Zulu",
        "Herero",
        "San"
      ],
      "ich"
    ],
    [
      "Vimbuza healing dance is associated especially with which people of Malawi?",
      "Tumbuka",
      [
        "Shona",
        "Akan",
        "Wolof"
      ],
      "ich"
    ],
    [
      "Kankurang is linked to initiation practices among which broad West African cultural community?",
      "Manding",
      [
        "Yoruba",
        "Akan",
        "Ewe"
      ],
      "ich"
    ],
    [
      "Gelede performances are traditionally associated with the social and spiritual roles of which communities?",
      "Yoruba-Nago",
      [
        "Maasai",
        "Tuareg",
        "Afar"
      ],
      "ich"
    ],
    [
      "The Manden Charter is traditionally linked to the founding era of which medieval West African empire?",
      "The Mali Empire",
      [
        "The Songhai Empire",
        "The Ghana Empire",
        "The Kanem-Bornu Empire"
      ],
      "ich"
    ],
    [
      "In Yoruba Ifa divination, the corpus is organised around a set of signs commonly called what?",
      "Odù",
      [
        "Nsibidi",
        "Adinkra",
        "Tifinagh"
      ],
      "nigeria"
    ],
    [
      "Aso-oke is traditionally produced by weaving narrow strips that are later joined; which craft process is central?",
      "Strip weaving",
      [
        "Wax casting",
        "Stone inlay",
        "Glass blowing"
      ],
      "nigeria"
    ],
    [
      "Adire textiles are traditionally patterned through resist techniques often using which dye?",
      "Indigo",
      [
        "Saffron",
        "Cochineal",
        "Madder only"
      ],
      "nigeria"
    ],
    [
      "Bògòlanfini patterns are traditionally developed using fermented mud applied to cotton cloth in which country?",
      "Mali",
      [
        "Niger",
        "Chad",
        "Senegal"
      ],
      "ich"
    ],
    [
      "In ikat, the pattern is created by selectively binding and dyeing what before weaving?",
      "Yarns",
      [
        "Finished garments",
        "Wooden printing blocks",
        "Metal threads after weaving"
      ],
      "vam"
    ],
    [
      "Kintsugi traditionally uses urushi lacquer and metallic powder to emphasise what?",
      "The repaired seams of broken ceramics",
      [
        "The glaze on unbroken porcelain",
        "The carved base of wooden bowls",
        "The painted surface of silk screens"
      ],
      "met"
    ],
    [
      "Pysanka decoration uses wax-resist techniques on which object?",
      "An eggshell",
      [
        "A clay roof tile",
        "A wooden mask",
        "A glass vessel"
      ],
      "ich"
    ],
    [
      "Pattachitra is a painting tradition strongly associated with which Indian state and its temple culture?",
      "Odisha",
      [
        "Punjab",
        "Haryana",
        "Himachal Pradesh"
      ],
      "met"
    ],
    [
      "Madhubani painting is rooted in the Mithila region, which spans parts of India and which neighbouring country?",
      "Nepal",
      [
        "Bhutan",
        "Bangladesh",
        "Myanmar"
      ],
      "met"
    ],
    [
      "Warli paintings traditionally use white pigment against an earthy background, often depicting figures with what basic geometric forms?",
      "Circles and triangles",
      [
        "Spirals and hexagons",
        "Squares and cubes",
        "Stars and crescents"
      ],
      "met"
    ],
    [
      "The Benin court plaques commonly called the Benin Bronzes were traditionally produced using which metalworking method?",
      "Lost-wax casting",
      [
        " repoussé hammering",
        "Cloisonné enamelling",
        "Sand casting only"
      ],
      "bm"
    ],
    [
      "The naturalistic heads produced in the ancient city of Ife are associated with which present-day Nigerian state?",
      "Osun",
      [
        "Edo",
        "Anambra",
        "Katsina"
      ],
      "bm"
    ],
    [
      "The monumental stone walls of Great Zimbabwe were constructed primarily without what?",
      "Mortar",
      [
        "Granite",
        "Labour",
        "Stone blocks"
      ],
      "whc"
    ],
    [
      "The famous rock-hewn churches of Lalibela are located in which country?",
      "Ethiopia",
      [
        "Eritrea",
        "Sudan",
        "Kenya"
      ],
      "whc"
    ],
    [
      "The Great Mosque of Djenné is a major example of which broad architectural tradition?",
      "Sudano-Sahelian earthen architecture",
      [
        "Gothic stone architecture",
        "Mughal marble architecture",
        "Baroque brick architecture"
      ],
      "whc"
    ],
    [
      "The historic manuscript collections of Timbuktu are especially associated with scholarship in which broad intellectual tradition?",
      "Islamic learning in West Africa",
      [
        "Mesoamerican astronomy",
        "Byzantine naval engineering",
        "Japanese tea ceremony"
      ],
      "whc"
    ],
    [
      "The ancient stone stelae of Aksum are found in which country?",
      "Ethiopia",
      [
        "Ghana",
        "Mali",
        "Tanzania"
      ],
      "whc"
    ]
  ]
}
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
  ...makeLevel(CULTURE_ROWS.normal, 'normal', 47, [10, 12, 12, 12]),
  ...makeLevel(CULTURE_ROWS.hard, 'hard', 93, [10, 13, 13, 13]),
  ...makeLevel(CULTURE_ROWS.expert, 'expert', 142, [10, 13, 13, 13])
];
