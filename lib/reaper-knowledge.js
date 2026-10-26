// lib/reaper-knowledge.js
// REAPER (RPR) Clan Knowledge Base
// Base sa Messenger GC export ng REAPER clan

const REAPER_DESCRIPTION = `
Ang RPR (REAPER) ay isang clan sa Call of Duty: Mobile (CODM) na binubuo ng mga taga-Negros Oriental
(Cagayan de Oro, Davao, Bukidnon, Camiguin, Cebu, Tagum, at iba pa). Kilala sila sa:

• Bakatan — bardagulan at asaran sa GC (hindi literal na "bakla", expression lang ito)
• Esmeringhoy — ang tawag nila sa "flirting" o romantic talk (joke lang!)
• Chismisan — walang tulugan sa pagbabardagulan at pag-aasaran
• Tourna at Scrim — active sa CODM tournaments at scrimmages
• Walang tulugan — kayang magpuyat ng 48 hours kung kailangan

Common expressions: "Yawa!", "Piste!", "Atay!", "Buang!", "Tugpa na ko!", 
"Esmeringhoy na naman!", "Palamunin!", "Chix boy!", "Bakatan!", "Ggs!"

Ang RPR ay hindi lang clan — pamilya. Kahit magulo, solid ang samahan. 🫡
`;

const REAPER_MEMBERS = {
  "panuway": {
    aliases: ["panuway", "rpr panuway", "panuway v2", "2phe", "rpr 2phe", "panuway v1"],
    title: "RPR Panuway",
    description: "Ang 'Chix Boy' ng REAPER! 😎 Kilala bilang isa sa mga pinaka-babaero (joke lang!) sa clan. Laging present sa mga chismisan at tourna. Bakatan pero solid kausap at ka-tropa.",
    personality: ["Chix boy (joke)", "Bakatan", "Funny", "Active sa tourna", "Mahilig sa chismis", "Solid ka-tropa"],
    funFacts: [
      "Tawag sa kanya ng mga ka-clan: 'Panuway' (devil sa Bisaya, pero mabait naman daw)",
      "Madalas ma-mention sa mga bardagulan at asaran sa GC",
      "Isa sa mga pioneer ng RPR",
      "Laging kasama sa mga scrim at tourna"
    ]
  },
  "bug": {
    aliases: ["bug", "bug fied", "rpr bug", "bugfied", "rpr bug fied"],
    title: "Bug Fied",
    description: "Ang birthday celebrant ng October! 🎂 Pinaka-active sa GC, laging may pasabog na jokes at memes. 'Bagong baba' ang peg pero laging nandiyan para sa clan. Solid kaibigan.",
    personality: ["Funny", "Active sa GC", "Meme lord", "Bakatan", "Solid kaibigan", "Laging may pasabog"],
    funFacts: [
      "Birthday niya noong October 24 (nag-celebrate ang buong clan sa GC!)",
      "Laging may bagong profile pic at pabago-bagong nickname",
      "Isa sa mga pinaka-maingay sa voice chat",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "kharyang": {
    aliases: ["kharyang", "kara", "カ ー ラ", "te kharyang", "kharyang v2", "rpr kharyang", "kharyang v1"],
    title: "Kharyang (カ ー ラ)",
    description: "Ang 'Strong Woman' ng RPR! 💪 Walang tulugan, 48 hours gising kung kailangan. Bakatan pero may soft side din. Laging nandiyan para sa lahat — solid na kaibigan at ka-tropa.",
    personality: ["Strong woman", "Bakatan", "Walang tulugan", "Funny", "Solid", "May soft side"],
    funFacts: [
      "Kaya magpuyat ng 48 hours straight (confirmed sa GC!)",
      "Isang beses nakatulog ng 11am, gising ng 5pm — flex pa rin",
      "Laging nagsasabi ng 'tugpa na ko' pero hindi naman natutulog",
      "Madalas ma-mention sa mga bardagulan at asaran"
    ]
  },
  "motsi": {
    aliases: ["motsi", "mots", "jessuelle", "jessuelle lou patrimonio", "rpr motsi", "rpr motsi v2"],
    title: "Jessuelle Lou Patrimonio (Motsi)",
    description: "Ang 'Royal' ng Bukidnon! 👑 Taga-bukid pero laging online. Master ng 'esmeringhoy' at bardagulan. Solid kausap at laging may chismis. Hindi pwedeng mawala sa GC.",
    personality: ["Royal daw", "Taga-bukid", "Esmeringhoy master", "Funny", "Chismoso", "Laging online"],
    funFacts: [
      "Laging may 'esmeringhoy' reference sa mga sinasabi",
      "Taga-Bukidnon pero laging updated sa chismis ng buong Mindanao",
      "Madalas ma-mention na 'royal' ang peg",
      "Isa sa mga pinaka-active sa bardagulan"
    ]
  },
  "jomar": {
    aliases: ["jomar", "jomar refo real", "spydee", "mar", "rpr 2phe", "2phe", "jomar v2", "spydee v1"],
    title: "Jomar Refo Real (Spydee)",
    description: "Ang 'Palamunin' ng RPR! 🐶 Charot! Si Spydee, ang laging gutom at laging may baon. Bakatan at solid kasama sa tourna. Master ng 'nagkaon na mo guys?' at 'unsaon pag dula'.",
    personality: ["Palamunin (joke)", "Bakatan", "Laging gutom", "Funny", "Active sa tourna", "Mahilig sa pagkain"],
    funFacts: [
      "Tawag sa kanya: 'Spydee' o 'Mar'",
      "Laging may baon — 'nagkaon na mo guys?' ang peg",
      "Madalas ma-aksyunan sa mga bardagulan sa GC",
      "Isa sa mga pinaka-active sa scrim at tourna"
    ]
  },
  "don": {
    aliases: ["don", "don jmnz", "tita", "madam don", "rpr don", "rpr don jmnz"],
    title: "Don Jmnz (Tita)",
    description: "Ang 'Tita' ng RPR! 👑 Admin ng clan, laging may live stream sa TikTok, at nag-aayos ng tourna. Mabait pero 'wag kang magpapasaway — may paalala siya sa GC. Ang nagpapatakbo ng clan.",
    personality: ["Tita", "Admin", "Live streamer", "Mabait", "Disiplinado", "Organized"],
    funFacts: [
      "Laging may live stream sa TikTok",
      "Siya ang nag-aayos ng mga tourna at scrim",
      "Madalas mag-remind: 'Walang delete2 chats ha!'",
      "Ang nag-a-announce ng mga prize at results ng tourna"
    ]
  },
  "viara": {
    aliases: ["viara", "viaraa", "viaraa torres", "rpr viara", "rpr viaraa", "viara v2"],
    title: "Viaraa Torres (Viara)",
    description: "Ang 'Emotional Support' ng RPR! 🥺 Taga-Camiguin, laging may hugot at 'maoy' moments. Pero pagdating sa tourna, solid pa rin. Bakatan with feelings — laging may 'ug ako nalang diay?' moment.",
    personality: ["Taga-Camiguin", "Emotional", "Mahilig sa hugot", "Bakatan", "Funny", "May mood swings"],
    funFacts: [
      "Taga-Camiguin pero laging updated sa chismis ng Mindanao",
      "Laging may 'ug ako nalang diay?' moment",
      "Pag nag-relapse, buong GC ang kasama",
      "Madalas ma-mention sa mga bardagulan at asaran"
    ]
  },
  "beng": {
    aliases: ["beng", "maria", "maria sheena", "maria sheena neri limpangog", "rpr beng", "beng v2"],
    title: "Maria Sheena Neri Limpangog (Beng)",
    description: "Ang 'Nurse' ng RPR! 💉 Taga-Cagayan de Oro, laging may baon na chismis at payo. Gahig ulo pero mabait. Master ng 'pamahaw' posts at 'hala ka' moments.",
    personality: ["Nurse", "Taga-CDO", "Gahig ulo", "Funny", "Chismoso", "Mabait"],
    funFacts: [
      "Laging may pamahaw post sa GC",
      "Madalas ma-mention na 'beng' sa mga chismis",
      "Nurse pero laging walang tulog",
      "Isa sa mga pinaka-active sa bardagulan"
    ]
  },
  "shane": {
    aliases: ["shane", "shane peligro", "mots", "mochi", "rpr mots", "rpr mots v2"],
    title: "Shane Peligro (Mots/Mochi)",
    description: "Ang 'Mochi' ng RPR! 🍡 Funny at bakatan, laging may bagong meme at kalokohan. Active sa voice chat at tourna. Laging may 'haha' at 'omg' moments.",
    personality: ["Funny", "Bakatan", "Active sa VC", "Meme lord", "Laging may kalokohan"],
    funFacts: [
      "Madalas tawagin na 'Mots' o 'Mochi'",
      "Laging may bagong meme sa GC",
      "Isa sa mga active sa scrim at tourna",
      "Madalas kasama sa mga bardagulan at asaran"
    ]
  },
  "chef": {
    aliases: ["thrics", "thrics capricho", "chef", "rpr thrics", "thrics v2"],
    title: "Thrics Capricho (Chef)",
    description: "Ang 'Chef' ng RPR! 👨‍🍳 Laging may baon na pagkain at payo. Bakatan pero may sense kausap. Isa sa mga tinataguriang 'palamunin' (joke) at laging present sa scrim.",
    personality: ["Chef", "Funny", "Bakatan", "Matulungin", "Active sa scrim"],
    funFacts: [
      "Tawag sa kanya: 'Chef'",
      "Laging may baon na pagkain sa GC",
      "Isa sa mga tinataguriang 'palamunin' (joke)",
      "Madalas ma-mention sa mga scrim results"
    ]
  },
  "fexx": {
    aliases: ["fexx", "topia", "topia ej", "motsi", "rpr fexx", "rpr topia", "topia v2"],
    title: "Topia Ej (Fexx/Motsi)",
    description: "Ang 'Motsi' ng RPR! 🎮 Active sa scrim at tourna, laging may update sa mga laban. Bakatan at solid kausap. Laging may 'sge tita' at 'ggs' moments.",
    personality: ["Active sa scrim", "Funny", "Bakatan", "Updated sa tourna", "Solid kausap"],
    funFacts: [
      "Laging may scrim updates sa GC",
      "Madalas ma-mention sa mga tourna results",
      "Laging nagsasabi ng 'sge tita' at 'ggs'"
    ]
  },
  "zie": {
    aliases: ["zie", "zeidrick", "zeidrick encarnacion", "ixi", "rpr zie", "rpr ixi", "zie v2"],
    title: "Zeidrick Encarnacion (Zie/Ixi)",
    description: "Ang 'Ixi' ng RPR! 🎯 Funny at bakatan, laging may bagong joke at asar. Active sa GC at tourna. Master ng 'HAHAHAHA' at 'yawa' expressions.",
    personality: ["Funny", "Bakatan", "Active sa GC", "Asarero", "Laging may banat"],
    funFacts: [
      "Tawag sa kanya: 'Zie' o 'Ixi'",
      "Laging may bagong banat sa GC",
      "Madalas ma-mention sa mga bardagulan at asaran"
    ]
  },
  "doc": {
    aliases: ["doc", "jhaylou", "jhaylou capurihan", "rpr doc", "doc v2"],
    title: "Jhaylou Capurihan (Doc)",
    description: "Ang 'Doktor' ng RPR! 🩺 Nurse sa profession, bakatan sa GC. Taga-Davao/Cagayan, laging may payo at chismis. Isa sa mga pinaka-active sa bardagulan at scrim.",
    personality: ["Nurse", "Funny", "Bakatan", "Taga-Davao", "Active sa GC", "Chismoso"],
    funFacts: [
      "Tawag sa kanya: 'Doc'",
      "Laging may medical advice (joke) sa GC",
      "Active sa mga bardagulan at chismisan",
      "Madalas ma-mention sa mga scrim results"
    ]
  },
  "tito": {
    aliases: ["tito", "steve", "steve stuart claret", "rpr tito", "cool tito"],
    title: "Steve Stuart Claret (Tito)",
    description: "Ang 'Cool Tito' ng RPR! 😎 Isa sa mga mas nakakatanda sa clan pero solid pa rin sa bardagulan at chismis. Bakatan pero may wisdom. Laging may 'rag mag kadtong sa incredibles' moments.",
    personality: ["Cool tito", "Bakatan", "May wisdom", "Funny", "Solid"],
    funFacts: [
      "Tawag sa kanya: 'Tito' o 'Cool Tito'",
      "Laging may payo sa mga bata (joke)",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "teody": {
    aliases: ["teody", "rpr teody", "teody v2"],
    title: "Teody",
    description: "Ang 'Laging Gutom' ng RPR! 🍚 Laging may pagkain sa GC at laging present sa bardagulan. Bakatan at solid kausap. Master ng 'inom ra daghan tubig' advice.",
    personality: ["Funny", "Bakatan", "Laging gutom", "Active sa GC", "Mahilig sa pagkain"],
    funFacts: [
      "Laging may food posts sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may advice na 'inom ra daghan tubig'"
    ]
  },
  "rodel": {
    aliases: ["rodel", "rodel seguerra edullantes", "rpr rodel", "rodel v2"],
    title: "Rodel Seguerra Edullantes",
    description: "Ang 'Taga-Cebu' ng RPR! 🌊 Bakatan at laging may baon na chismis. Active sa GC at tourna. Master ng 'pag mag inom ta' at 'esmeringhoy' moments.",
    personality: ["Taga-Cebu", "Bakatan", "Funny", "Chismoso", "Active sa GC"],
    funFacts: [
      "Taga-Cebu pero laging updated sa chismis ng Mindanao",
      "Madalas ma-mention na 'palamunin' (joke)",
      "Laging may 'pag mag inom ta' moments"
    ]
  },
  "ginno": {
    aliases: ["ginno", "ginno castillano", "k9", "rpr ginno", "k9 unit"],
    title: "Ginno Castillano (K9)",
    description: "Ang 'K9 Unit' ng RPR! 🐕 Laging may aso jokes at bakatan. Funny at active sa GC. Master ng 'k9 unit' references at 'pakan-a na lang kos yuta' moments.",
    personality: ["K9 unit (joke)", "Funny", "Bakatan", "Active sa GC", "Asarero"],
    funFacts: [
      "Tawag sa kanya: 'K9' o 'K9 Unit'",
      "Laging may dog-related jokes sa GC",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "arki": {
    aliases: ["arki", "rich man", "rich man c. piamonte", "rpr arki", "arki xiv"],
    title: "Rich Man C. Piamonte (Arki)",
    description: "Ang 'Arki' ng RPR! 🏗️ Architect sa profession, bakatan sa GC. Laging may funny remarks at chismis. Master ng 'expert' at 'GGs' moments.",
    personality: ["Architect", "Funny", "Bakatan", "Chismoso", "Active sa GC"],
    funFacts: [
      "Tawag sa kanya: 'Arki'",
      "Laging may architectural jokes (joke lang)",
      "Madalas ma-mention sa mga tourna results"
    ]
  },
  "macheekoi": {
    aliases: ["macheekoi", "jp", "jp sevandal", "2phe", "rpr macheekoi", "rpr 2phe", "macheekoi v2"],
    title: "Jp Sevandal (Macheekoi/2phe)",
    description: "Ang 'Taga-CDO' ng RPR! 🏙️ Bakatan at laging may baon na asar. Active sa GC at tourna. Master ng 'meng gabie mga ka childish' at 'batak pang iro' moments.",
    personality: ["Taga-CDO", "Bakatan", "Funny", "Asarero", "Active sa tourna"],
    funFacts: [
      "Tawag sa kanya: 'Macheekoi' o '2phe'",
      "Laging may funny remarks sa GC",
      "Madalas ma-mention sa mga scrim results"
    ]
  },
  "pat": {
    aliases: ["pat", "patrick", "patrick courtney bagares basay", "rpr pat"],
    title: "Patrick Courtney Bagares Basay (Pat)",
    description: "Ang 'Bakla' ng RPR! 🏳️‍🌈 (joke lang!) Funny at bakatan, laging may bagong asar at kalokohan. Master ng 'medic' at 'GGs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC", "Meme lord"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may 'medic' references"
    ]
  },
  "hudas": {
    aliases: ["hudas", "ron", "ron magdo", "rpr hudas", "hudas v1", "hudas v2"],
    title: "Ron Magdo (Hudas)",
    description: "Ang 'Hudas' ng RPR! 🤣 (joke lang!) Funny at bakatan, laging may baon na chismis at asar. Master ng 'nagpaon' at 'GGs' moments. Isa sa mga pinaka-active sa scrim.",
    personality: ["Hudas (joke)", "Funny", "Bakatan", "Chismoso", "Active sa scrim"],
    funFacts: [
      "Tawag sa kanya: 'Hudas' (joke lang, loyal naman daw)",
      "Laging may bagong chismis sa GC",
      "Madalas ma-mention sa mga scrim results"
    ]
  },
  "clark": {
    aliases: ["clark", "clark henley", "clark henley ypo limbaga", "rpr clark"],
    title: "Clark Henley Ypo Limbaga",
    description: "Bakatan at funny, laging active sa GC at scrim. Solid kausap at laging may baon na asar. Master ng 'Nt ggs lng' at 'sge tita' moments.",
    personality: ["Funny", "Bakatan", "Active sa scrim", "Asarero", "Solid kausap"],
    funFacts: [
      "Laging may scrim updates",
      "Madalas ma-mention sa mga tourna results",
      "Laging may 'Nt ggs lng' messages"
    ]
  },
  "ferbz": {
    aliases: ["ferbz", "cutamora", "cutamora ferbz", "rpr ferbz"],
    title: "Cutamora Ferbz",
    description: "Bakatan at funny, laging may baon na chismis at asar. Active sa GC at tourna. Master ng 'ggs' at 'makaon sa' moments.",
    personality: ["Funny", "Bakatan", "Chismoso", "Active sa tourna", "Laging gutom"],
    funFacts: [
      "Laging may funny remarks sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may 'ggs' messages"
    ]
  },
  "manuel": {
    aliases: ["manuel", "manuel gornes", "rpr manuel", "manuel v2"],
    title: "Manuel Gornes",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'dula ta' at 'wala pa' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "johnver": {
    aliases: ["johnver", "rpr johnver"],
    title: "Johnver",
    description: "Bakatan at funny, laging may baon na asar at chismis. Active sa GC at tourna. Master ng 'good morning' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Chismoso", "Active sa tourna"],
    funFacts: [
      "Laging may funny remarks sa GC",
      "Madalas ma-mention sa mga scrim results",
      "Laging may 'good morning' messages"
    ]
  },
  "bonie": {
    aliases: ["bonie", "bonie bacasmas", "rpr bonie", "bonz"],
    title: "Bonie Bacasmas (Bonz)",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC at tourna. Master ng 'amuti nnyo kol' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC", "Taga-CDO"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may 'amuti nnyo kol' messages"
    ]
  },
  "karl": {
    aliases: ["karl", "karl chavez", "rpr karl"],
    title: "Karl Chavez",
    description: "Bakatan at funny, laging may baon na asar at chismis. Active sa GC at tourna. Master ng 'br+1' at 'sipsip' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'br+1' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "lydio": {
    aliases: ["lydio", "lydio amaro", "rpr lydio"],
    title: "Lydio Amaro",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'unsa gni to imong ign' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "nerts": {
    aliases: ["nerts", "nerts vinson", "rpr nerts"],
    title: "Nerts Vinson",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'react rako kapoy chat' at 'dota2 mobile' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'react rako kapoy chat' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "brylle": {
    aliases: ["brylle", "brylle woo tanquiamco", "brylle tanquiamco", "rpr brylle"],
    title: "Brylle Woo Tanquiamco",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'nawala ag signal' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'nawala ag signal' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "xin": {
    aliases: ["xin", "xin nalibac", "rpr xin"],
    title: "Xin Nalibac",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'suggest daw mo android phone' at 'lamia gyud nimo lovoton sung' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'suggest daw mo android phone' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "kristan": {
    aliases: ["kristan", "kristan james", "kristan james lobitaña", "rpr kristan"],
    title: "Kristan James Lobitaña",
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC at ML. Master ng 'ml +4' at 'ign for roamer' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC", "ML player"],
    funFacts: [
      "Laging may 'ml +4' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  }
};

// === REAPER INSIDE JOKES & TERMS ===
const REAPER_INSIDE_JOKES = {
  "esmeringhoy": "Ang tawag ng RPR sa 'flirting' o 'romantic talk'. Laging ginagamit ni Motsi at ng iba pang members. Halimbawa: 'Esmeringhoy na naman kayo dyan!'",
  "bakatan": "Tawag sa mga member na mahilig mag-asaran at mag-bardagulan. Hindi ito literal na 'bakla' — expression lang ito ng RPR. Halimbawa: 'Bakatan jud ning mga tawhana!'",
  "palamunin": "Joke term para sa mga member na laging gutom o laging may baon. Karaniwang tinatawag ito kay Jomar/Spydee at kay Chef.",
  "chix boy": "Tawag kay RPR Panuway dahil sa pagiging 'babaero' (joke lang!). Halimbawa: 'Si Panuway chix boy kaayo oy!'",
  "marimar": "Nickname na madalas gamitin para kay Jomar o sa mga member na mahilig mag-drama. Halimbawa: 'Ay si marimar man diay ni!'",
  "tugpa": "Ang tawag ng RPR sa 'pag tulog' o 'pag rest'. Halimbawa: 'Tugpa na ko mga bossing, ggs!'",
  "scrim": "Scrimmage — practice game ng RPR laban sa ibang clan. Laging may scrim tuwing gabi.",
  "tourna": "Tournament — ang main event ng RPR kung saan may premyo. Laging may tourna tuwing weekend.",
  "sumbagay": "Fight o away (joke lang sa GC). Halimbawa: 'Sumbagay na lang ta ani!'",
  "tagay": "Drinking session ng mga RPR members. Halimbawa: 'Tagay na naman mga bossing!'",
  "yawa": "Visayan expression (literal: devil), ginagamit bilang expression ng surprise o frustration. Hindi literal na insulto. Halimbawa: 'Yawa kaayo oy!'",
  "piste": "Visayan expression (literal: pest), ginagamit bilang expression ng frustration. Halimbawa: 'Piste maning kinabuhia ni!'",
  "atay": "Visayan expression (literal: liver), ginagamit bilang expression ng frustration. Parang 'darn' sa English. Halimbawa: 'Atay man diay ni oy!'",
  "buang": "Visayan para sa 'crazy', ginagamit bilang expression ng surprise o joke. Halimbawa: 'Buang man ka oy!'",
  "bossing": "Tawag sa mga leader o admin ng RPR. Halimbawa: 'Bossing, naa kay load diha?'",
  "tita": "Tawag kay Don Jmnz, ang admin ng RPR. Halimbawa: 'Tita Don, mag live ka na?'",
  "tito": "Tawag kay Steve Stuart Claret, ang 'cool tito' ng RPR. Halimbawa: 'Tito Steve, unsa may advice nimo?'",
  "kaber": "Partner o jowa (joke o seryoso). Halimbawa: 'Asa na si kaber?'",
  "bebe girl": "Girlfriend o ka-romance (joke o seryoso). Halimbawa: 'Asa na si bebe girl?'",
  "labs": "Love o mahal (expression ng affection sa GC). Halimbawa: 'Labs na natin ang RPR!'",
  "ggs": "Good game(s) — expression pagkatapos ng laban. Halimbawa: 'Ggs mga bossing!'",
  "nt": "Nice try — expression pagkatapos ng laban kahit natalo. Halimbawa: 'Nt lang mga bossing, bawi next time.'",
  "pisot": "Isang uri ng rice cake, ginagamit ding joke insulto. Halimbawa: 'Pisot kaayo ka oy!'",
  "bogo": "Visayan para sa 'fool', ginagamit bilang joke. Halimbawa: 'Bogo man ka oy!'",
  "animal": "Expression ng surprise o frustration (hindi literal). Halimbawa: 'Animala man diay ni oy!'",
  "kns hit": "Isang clan na kalaban ng RPR sa scrim. Halimbawa: 'Gipildi nato ang KNS HIT!'",
  "mpl": "Mobile Legends: Bang Bang — isa pang laro ng RPR members. Halimbawa: 'Mpl ta ninyo!'",
  "codm": "Call of Duty: Mobile — ang main game ng RPR. Halimbawa: 'Codm ta ninyo!'",
  "loadout": "Ang setup ng armas sa CODM. Halimbawa: 'Unsa may loadout aning dingo?'",
  "dingo": "Isang armas sa CODM na laging pinag-uusapan ng RPR. Halimbawa: 'Nindota sa dingo ni Don oy!'",
  "smrs": "Isang armas sa CODM na laging pinag-uusapan ng RPR. Halimbawa: 'Wala nibuto ang smrs!'",
  "dogtag": "Isang mode sa CODM kung saan kailangan makuha ang dogtag ng kalaban. Halimbawa: 'Bantayi ang dogtag!'",
  "buhat": "Ang tawag ng RPR sa 'pag laro' o 'pag-practice.' Halimbawa: 'Salamat sa buhat mga bossing!'",
  "pahuway": "Visayan para sa 'rest' o 'pahinga.' Halimbawa: 'Pahuway sa ta mga bossing.'",
  "laag": "Visayan para sa 'gala' o 'lakwatsa.' Halimbawa: 'Laag ta ninyo!'",
  "kaon": "Visayan para sa 'kain.' Halimbawa: 'Kaon na ta mga bossing!'",
  "inom": "Visayan para sa 'inom.' Halimbawa: 'Inom ta ninyo!'",
  "tulog": "Filipino para sa 'sleep.' Halimbawa: 'Tulog na ko mga bossing.'",
  "mata": "Filipino para sa 'gising.' Halimbawa: 'Mata pa ko mga bossing.'"
};

/**
 * Search for a member by name/alias
 * @param {string} query - The search query
 * @returns {object|null} - The member profile or null if not found
 */
function searchMember(query) {
  if (!query) return null;
  
  const normalizedQuery = query.toLowerCase().trim();
  
  for (const [key, member] of Object.entries(REAPER_MEMBERS)) {
    for (const alias of member.aliases) {
      if (alias.toLowerCase().includes(normalizedQuery) || 
          normalizedQuery.includes(alias.toLowerCase())) {
        return { key, ...member };
      }
    }
    if (member.title.toLowerCase().includes(normalizedQuery)) {
      return { key, ...member };
    }
  }
  
  return null;
}

/**
 * Get all members for a listing
 * @returns {Array} - Array of all member profiles
 */
function getAllMembers() {
  return Object.entries(REAPER_MEMBERS).map(([key, member]) => ({
    key,
    ...member
  }));
}

/**
 * Generate a formatted response for a member search
 * @param {string} query - The search query
 * @returns {string|null} - Formatted response string
 */
function getMemberResponse(query) {
  const member = searchMember(query);
  
  if (!member) return null;
  
  return `📌 **${member.title}**

${member.description}

**Personality:** ${member.personality.join(", ")}

**Fun Facts:**
${member.funFacts.map(fact => `• ${fact}`).join("\n")}

_— mula sa REAPER clan knowledge base 🫡_`;
}

/**
 * Generate the full REAPER knowledge context for the AI prompt
 * @returns {string} - The knowledge context
 */
function getReaperContext() {
  let context = REAPER_DESCRIPTION + "\n\n";
  
  context += "=== REAPER MEMBER PROFILES ===\n\n";
  
  for (const [key, member] of Object.entries(REAPER_MEMBERS)) {
    context += `**${member.title}**\n`;
    context += `${member.description}\n`;
    context += `Personality: ${member.personality.join(", ")}\n`;
    context += `Fun Facts: ${member.funFacts.join(" | ")}\n\n`;
  }
  
  context += "=== REAPER INSIDE JOKES & TERMS ===\n\n";
  
  for (const [term, meaning] of Object.entries(REAPER_INSIDE_JOKES)) {
    context += `• **${term}**: ${meaning}\n`;
  }
  
  return context;
}

module.exports = {
  REAPER_MEMBERS,
  REAPER_INSIDE_JOKES,
  REAPER_DESCRIPTION,
  searchMember,
  getAllMembers,
  getMemberResponse,
  getReaperContext
};
