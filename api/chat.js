// api/chat.js - Imachui Gen AI (Ultimate Creator Lore & Direct Responses + REAPER Personalities)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import staffData from '../staff-data.json';
import rprData from '../rpr-data.json';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

// ============================================================================
// === [NEW] REAPER CLAN PERSONALITY KNOWLEDGE BASE ===
// Supplements rpr-data.json with attitude, inside jokes, and fun facts.
// Safe: kapag walang match, tuloy lang ang normal AI flow.
// ============================================================================

const REAPER_PERSONALITIES = {
  "panuway": {
    title: "RPR Panuway (2phe)",
    aliases: ["panuway", "2phe", "rpr 2phe", "panuway v1", "panuway v2"],
    description: "Ang 'Chix Boy' ng REAPER! 😎 Charot lang — pero solid na ka-tropa. Laging present sa chismisan at tourna, bakatan pero may soft side din.",
    personality: ["Chix boy (joke)", "Bakatan", "Funny", "Active sa tourna", "Mahilig sa chismis", "Solid ka-tropa"],
    funFacts: [
      "Tawag sa kanya: 'Panuway' (devil sa Bisaya, pero mabait naman daw)",
      "Madalas ma-mention sa mga bardagulan at asaran sa GC",
      "Isa sa mga pioneer ng RPR",
      "Laging kasama sa mga scrim at tourna"
    ]
  },
  "bug": {
    title: "Bug Fied",
    aliases: ["bug", "bugfied", "bug fied", "rpr bug"],
    description: "Ang birthday celebrant ng October! 🎂 Pinaka-active sa GC, laging may pasabog na jokes at memes. 'Bagong baba' ang peg pero laging nandiyan para sa clan.",
    personality: ["Funny", "Active sa GC", "Meme lord", "Bakatan", "Solid kaibigan", "Laging may pasabog"],
    funFacts: [
      "Birthday niya noong October 24 — nag-celebrate ang buong clan sa GC!",
      "Laging may bagong profile pic at pabago-bagong nickname",
      "Isa sa mga pinaka-maingay sa voice chat",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "kharyang": {
    title: "Kharyang (カ ー ラ / Kara)",
    aliases: ["kharyang", "kara", "カ ー ラ", "te kharyang", "kharyang v1", "kharyang v2"],
    description: "Ang 'Strong Woman' ng RPR! 💪 Walang tulugan, 48 hours gising kung kailangan. Bakatan pero may soft side din. Laging nandiyan para sa lahat.",
    personality: ["Strong woman", "Bakatan", "Walang tulugan", "Funny", "Solid", "May soft side"],
    funFacts: [
      "Kaya magpuyat ng 48 hours straight (confirmed sa GC!)",
      "Isang beses nakatulog ng 11am, gising ng 5pm — flex pa rin",
      "Laging nagsasabi ng 'tugpa na ko' pero hindi naman natutulog",
      "Madalas ma-mention sa mga bardagulan at asaran"
    ]
  },
  "motsi": {
    title: "Jessuelle Lou Patrimonio (Motsi)",
    aliases: ["motsi", "mots", "jessuelle", "jessuelle lou patrimonio", "rpr motsi", "rpr motsi v2"],
    description: "Ang 'Royal' ng Bukidnon! 👑 Taga-bukid pero laging online. Master ng 'esmeringhoy' at bardagulan. Solid kausap at laging may chismis.",
    personality: ["Royal daw", "Taga-bukid", "Esmeringhoy master", "Funny", "Chismoso", "Laging online"],
    funFacts: [
      "Laging may 'esmeringhoy' reference sa mga sinasabi",
      "Taga-Bukidnon pero laging updated sa chismis ng buong Mindanao",
      "Madalas ma-mention na 'royal' ang peg",
      "Isa sa mga pinaka-active sa bardagulan"
    ]
  },
  "jomar": {
    title: "Jomar Refo Real (Spydee / Mar)",
    aliases: ["jomar", "jomar refo real", "spydee", "spydee v1", "mar", "jomar v2"],
    description: "Ang 'Palamunin' ng RPR! 🐶 Charot! Si Spydee, ang laging gutom at laging may baon. Bakatan at solid kasama sa tourna. Master ng 'nagkaon na mo guys?'.",
    personality: ["Palamunin (joke)", "Bakatan", "Laging gutom", "Funny", "Active sa tourna", "Mahilig sa pagkain"],
    funFacts: [
      "Tawag sa kanya: 'Spydee' o 'Mar'",
      "Laging may baon — 'nagkaon na mo guys?' ang peg",
      "Madalas ma-aksyunan sa mga bardagulan sa GC",
      "Isa sa mga pinaka-active sa scrim at tourna"
    ]
  },
  "don": {
    title: "Don Jmnz (Tita)",
    aliases: ["don", "don jmnz", "tita", "madam don", "rpr don", "rpr don jmnz"],
    description: "Ang 'Tita' ng RPR! 👑 Admin ng clan, laging may live stream sa TikTok, at nag-aayos ng tourna. Mabait pero 'wag kang magpapasaway — may paalala siya sa GC.",
    personality: ["Tita", "Admin", "Live streamer", "Mabait", "Disiplinado", "Organized"],
    funFacts: [
      "Laging may live stream sa TikTok",
      "Siya ang nag-aayos ng mga tourna at scrim",
      "Madalas mag-remind: 'Walang delete2 chats ha!'",
      "Ang nag-a-announce ng mga prize at results ng tourna"
    ]
  },
  "viara": {
    title: "Viaraa Torres (Viara)",
    aliases: ["viara", "viaraa", "viaraa torres", "rpr viara", "rpr viaraa", "viara v2"],
    description: "Ang 'Emotional Support' ng RPR! 🥺 Taga-Camiguin, laging may hugot at 'maoy' moments. Pero pagdating sa tourna, solid pa rin. Laging may 'ug ako nalang diay?' moment.",
    personality: ["Taga-Camiguin", "Emotional", "Mahilig sa hugot", "Bakatan", "Funny", "May mood swings"],
    funFacts: [
      "Taga-Camiguin pero laging updated sa chismis ng Mindanao",
      "Laging may 'ug ako nalang diay?' moment",
      "Pag nag-relapse, buong GC ang kasama",
      "Madalas ma-mention sa mga bardagulan at asaran"
    ]
  },
  "beng": {
    title: "Maria Sheena Neri Limpangog (Beng)",
    aliases: ["beng", "maria", "maria sheena", "maria sheena neri limpangog", "rpr beng", "beng v2"],
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
    title: "Shane Peligro (Mots / Mochi)",
    aliases: ["shane", "shane peligro", "mots", "mochi", "rpr mots", "rpr mots v2"],
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
    title: "Thrics Capricho (Chef)",
    aliases: ["thrics", "thrics capricho", "chef", "rpr thrics", "thrics v2"],
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
    title: "Topia Ej (Fexx)",
    aliases: ["fexx", "topia", "topia ej", "rpr fexx", "rpr topia", "topia v2"],
    description: "Ang 'Motsi' ng RPR! 🎮 Active sa scrim at tourna, laging may update sa mga laban. Bakatan at solid kausap. Laging may 'sge tita' at 'ggs' moments.",
    personality: ["Active sa scrim", "Funny", "Bakatan", "Updated sa tourna", "Solid kausap"],
    funFacts: [
      "Laging may scrim updates sa GC",
      "Madalas ma-mention sa mga tourna results",
      "Laging nagsasabi ng 'sge tita' at 'ggs'"
    ]
  },
  "zie": {
    title: "Zeidrick Encarnacion (Zie / Ixi)",
    aliases: ["zie", "zeidrick", "zeidrick encarnacion", "ixi", "rpr zie", "rpr ixi", "zie v2"],
    description: "Ang 'Ixi' ng RPR! 🎯 Funny at bakatan, laging may bagong joke at asar. Active sa GC at tourna. Master ng 'HAHAHAHA' at 'yawa' expressions.",
    personality: ["Funny", "Bakatan", "Active sa GC", "Asarero", "Laging may banat"],
    funFacts: [
      "Tawag sa kanya: 'Zie' o 'Ixi'",
      "Laging may bagong banat sa GC",
      "Madalas ma-mention sa mga bardagulan at asaran"
    ]
  },
  "doc": {
    title: "Jhaylou Capurihan (Doc)",
    aliases: ["doc", "jhaylou", "jhaylou capurihan", "rpr doc", "doc v2"],
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
    title: "Steve Stuart Claret (Tito)",
    aliases: ["tito", "steve", "steve stuart claret", "rpr tito", "cool tito"],
    description: "Ang 'Cool Tito' ng RPR! 😎 Isa sa mga mas nakakatanda sa clan pero solid pa rin sa bardagulan at chismis. Bakatan pero may wisdom. Laging may 'rag mag kadtong sa incredibles' moments.",
    personality: ["Cool tito", "Bakatan", "May wisdom", "Funny", "Solid"],
    funFacts: [
      "Tawag sa kanya: 'Tito' o 'Cool Tito'",
      "Laging may payo sa mga bata (joke)",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "teody": {
    title: "Teody",
    aliases: ["teody", "rpr teody", "teody v2"],
    description: "Ang 'Laging Gutom' ng RPR! 🍚 Laging may pagkain sa GC at laging present sa bardagulan. Bakatan at solid kausap. Master ng 'inom ra daghan tubig' advice.",
    personality: ["Funny", "Bakatan", "Laging gutom", "Active sa GC", "Mahilig sa pagkain"],
    funFacts: [
      "Laging may food posts sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may advice na 'inom ra daghan tubig'"
    ]
  },
  "rodel": {
    title: "Rodel Seguerra Edullantes",
    aliases: ["rodel", "rodel seguerra edullantes", "rpr rodel", "rodel v2"],
    description: "Ang 'Taga-Cebu' ng RPR! 🌊 Bakatan at laging may baon na chismis. Active sa GC at tourna. Master ng 'pag mag inom ta' at 'esmeringhoy' moments.",
    personality: ["Taga-Cebu", "Bakatan", "Funny", "Chismoso", "Active sa GC"],
    funFacts: [
      "Taga-Cebu pero laging updated sa chismis ng Mindanao",
      "Madalas ma-mention na 'palamunin' (joke)",
      "Laging may 'pag mag inom ta' moments"
    ]
  },
  "ginno": {
    title: "Ginno Castillano (K9)",
    aliases: ["ginno", "ginno castillano", "k9", "rpr ginno", "k9 unit"],
    description: "Ang 'K9 Unit' ng RPR! 🐕 Laging may aso jokes at bakatan. Funny at active sa GC. Master ng 'k9 unit' references at 'pakan-a na lang kos yuta' moments.",
    personality: ["K9 unit (joke)", "Funny", "Bakatan", "Active sa GC", "Asarero"],
    funFacts: [
      "Tawag sa kanya: 'K9' o 'K9 Unit'",
      "Laging may dog-related jokes sa GC",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "arki": {
    title: "Rich Man C. Piamonte (Arki)",
    aliases: ["arki", "rich man", "rich man c. piamonte", "rpr arki", "arki xiv"],
    description: "Ang 'Arki' ng RPR! 🏗️ Architect sa profession, bakatan sa GC. Laging may funny remarks at chismis. Master ng 'expert' at 'GGs' moments.",
    personality: ["Architect", "Funny", "Bakatan", "Chismoso", "Active sa GC"],
    funFacts: [
      "Tawag sa kanya: 'Arki'",
      "Laging may architectural jokes (joke lang)",
      "Madalas ma-mention sa mga tourna results"
    ]
  },
  "macheekoi": {
    title: "Jp Sevandal (Macheekoi / 2phe)",
    aliases: ["macheekoi", "jp", "jp sevandal", "2phe", "rpr macheekoi", "rpr 2phe", "macheekoi v2"],
    description: "Ang 'Taga-CDO' ng RPR! 🏙️ Bakatan at laging may baon na asar. Active sa GC at tourna. Master ng 'meng gabie mga ka childish' at 'batak pang iro' moments.",
    personality: ["Taga-CDO", "Bakatan", "Funny", "Asarero", "Active sa tourna"],
    funFacts: [
      "Tawag sa kanya: 'Macheekoi' o '2phe'",
      "Laging may funny remarks sa GC",
      "Madalas ma-mention sa mga scrim results"
    ]
  },
  "pat": {
    title: "Patrick Courtney Bagares Basay (Pat)",
    aliases: ["pat", "patrick", "patrick courtney bagares basay", "rpr pat"],
    description: "Ang 'Bakla' ng RPR! 🏳️‍🌈 (joke lang!) Funny at bakatan, laging may bagong asar at kalokohan. Master ng 'medic' at 'GGs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC", "Meme lord"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may 'medic' references"
    ]
  },
  "hudas": {
    title: "Ron Magdo (Hudas)",
    aliases: ["hudas", "ron", "ron magdo", "rpr hudas", "hudas v1", "hudas v2"],
    description: "Ang 'Hudas' ng RPR! 🤣 (joke lang!) Funny at bakatan, laging may baon na chismis at asar. Master ng 'nagpaon' at 'GGs' moments. Isa sa mga pinaka-active sa scrim.",
    personality: ["Hudas (joke)", "Funny", "Bakatan", "Chismoso", "Active sa scrim"],
    funFacts: [
      "Tawag sa kanya: 'Hudas' (joke lang, loyal naman daw)",
      "Laging may bagong chismis sa GC",
      "Madalas ma-mention sa mga scrim results"
    ]
  },
  "clark": {
    title: "Clark Henley Ypo Limbaga",
    aliases: ["clark", "clark henley", "clark henley ypo limbaga", "rpr clark"],
    description: "Bakatan at funny, laging active sa GC at scrim. Solid kausap at laging may baon na asar. Master ng 'Nt ggs lng' at 'sge tita' moments.",
    personality: ["Funny", "Bakatan", "Active sa scrim", "Asarero", "Solid kausap"],
    funFacts: [
      "Laging may scrim updates",
      "Madalas ma-mention sa mga tourna results",
      "Laging may 'Nt ggs lng' messages"
    ]
  },
  "ferbz": {
    title: "Cutamora Ferbz",
    aliases: ["ferbz", "cutamora", "cutamora ferbz", "rpr ferbz"],
    description: "Bakatan at funny, laging may baon na chismis at asar. Active sa GC at tourna. Master ng 'ggs' at 'makaon sa' moments.",
    personality: ["Funny", "Bakatan", "Chismoso", "Active sa tourna", "Laging gutom"],
    funFacts: [
      "Laging may funny remarks sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may 'ggs' messages"
    ]
  },
  "manuel": {
    title: "Manuel Gornes",
    aliases: ["manuel", "manuel gornes", "rpr manuel", "manuel v2"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'dula ta' at 'wala pa' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "johnver": {
    title: "Johnver",
    aliases: ["johnver", "rpr johnver"],
    description: "Bakatan at funny, laging may baon na asar at chismis. Active sa GC at tourna. Master ng 'good morning' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Chismoso", "Active sa tourna"],
    funFacts: [
      "Laging may funny remarks sa GC",
      "Madalas ma-mention sa mga scrim results",
      "Laging may 'good morning' messages"
    ]
  },
  "bonie": {
    title: "Bonie Bacasmas (Bonz)",
    aliases: ["bonie", "bonie bacasmas", "rpr bonie", "bonz"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC at tourna. Master ng 'amuti nnyo kol' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC", "Taga-CDO"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan",
      "Laging may 'amuti nnyo kol' messages"
    ]
  },
  "karl": {
    title: "Karl Chavez",
    aliases: ["karl", "karl chavez", "rpr karl"],
    description: "Bakatan at funny, laging may baon na asar at chismis. Active sa GC at tourna. Master ng 'br+1' at 'sipsip' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'br+1' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "lydio": {
    title: "Lydio Amaro",
    aliases: ["lydio", "lydio amaro", "rpr lydio"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'unsa gni to imong ign' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may bagong joke sa GC",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "nerts": {
    title: "Nerts Vinson (Nerts)",
    aliases: ["nerts", "nerts vinson", "rpr nerts"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'react rako kapoy chat' at 'dota2 mobile' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'react rako kapoy chat' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "brylle": {
    title: "Brylle Woo Tanquiamco",
    aliases: ["brylle", "brylle woo tanquiamco", "brylle tanquiamco", "rpr brylle"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'nawala ag signal' at 'ggs' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'nawala ag signal' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "xin": {
    title: "Xin Nalibac",
    aliases: ["xin", "xin nalibac", "rpr xin"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC. Master ng 'suggest daw mo android phone' at 'lamia gyud nimo lovoton sung' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC"],
    funFacts: [
      "Laging may 'suggest daw mo android phone' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  },
  "kristan": {
    title: "Kristan James Lobitaña",
    aliases: ["kristan", "kristan james", "kristan james lobitaña", "rpr kristan"],
    description: "Bakatan at funny, laging may baon na asar at kalokohan. Active sa GC at ML. Master ng 'ml +4' at 'ign for roamer' moments.",
    personality: ["Funny", "Bakatan", "Asarero", "Active sa GC", "ML player"],
    funFacts: [
      "Laging may 'ml +4' messages",
      "Madalas ma-mention sa mga bardagulan"
    ]
  }
};

const REAPER_INSIDE_JOKES = {
  "esmeringhoy": "Ang tawag ng RPR sa 'flirting' o 'romantic talk'. Laging ginagamit ni Motsi at ng iba pang members. Halimbawa: 'Esmeringhoy na naman kayo dyan!'",
  "bakatan": "Tawag sa mga member na mahilig mag-asaran at mag-bardagulan. Hindi literal na 'bakla' — expression lang ito ng RPR. Halimbawa: 'Bakatan jud ning mga tawhana!'",
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
  "inom": "Visayan para sa 'inom.' Halimbawa: 'Inom ta ninyo!'"
};

const REAPER_CLAN_DESCRIPTION = `
Ang RPR (REAPER) ay isang clan sa Call of Duty: Mobile (CODM) na binubuo ng mga taga-Mindanao 
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

/**
 * Search for a REAPER member by nickname/real name/alias.
 * Returns the personality profile or null.
 */
function searchReaperProfile(query) {
  if (!query) return null;

  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanQuery.length < 2) return null;

  const queryWords = cleanQuery.split(' ').filter(w => w.length > 1);
  if (!queryWords.length) return null;

  for (const [key, profile] of Object.entries(REAPER_PERSONALITIES)) {
    const searchable = (
      profile.title + ' ' + 
      profile.aliases.join(' ') + ' ' +
      profile.description
    ).toLowerCase();

    // Match if any query word (length > 1) appears in searchable text
    if (queryWords.some(word => searchable.includes(word))) {
      return { key, ...profile };
    }
  }

  return null;
}

/**
 * Full REAPER context for the AI system prompt.
 * Includes clan description, member personalities, and inside jokes.
 */
function getReaperContext() {
  let ctx = '=== REAPER (RPR) CLAN CONTEXT ===\n';
  ctx += REAPER_CLAN_DESCRIPTION + '\n';

  ctx += '=== RPR MEMBER PERSONALITIES (EXTRA FLAVOR) ===\n';
  for (const profile of Object.values(REAPER_PERSONALITIES)) {
    ctx += `\n**${profile.title}**\n`;
    ctx += `${profile.description}\n`;
    ctx += `Personality: ${profile.personality.join(', ')}\n`;
    ctx += `Fun Facts: ${profile.funFacts.join(' | ')}\n`;
  }

  ctx += '\n=== RPR INSIDE JOKES & TERMS ===\n';
  for (const [term, meaning] of Object.entries(REAPER_INSIDE_JOKES)) {
    ctx += `• **${term}**: ${meaning}\n`;
  }

  ctx += '\n=== END REAPER CONTEXT ===\n';
  return ctx;
}

// ============================================================================
// === END [NEW] REAPER CLAN PERSONALITY KNOWLEDGE BASE ===
// ============================================================================

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeMessages(body) {
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  return incoming
    .filter(m => m && ["user", "assistant"].includes(m.role) && (typeof m.content === "string" || Array.isArray(m.content)))
    .slice(-20)
    .map(m => {
      let content = m.content;
      if (Array.isArray(content)) {
        content = content.map(item => {
          if (item.type === 'image_url') {
            return { type: 'image', image: item.image_url?.url || item.image_url };
          }
          return item;
        });
      }
      return { role: m.role, content: content };
    });
}

async function searchWeb(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 3 }),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        let results = "LIVE SEARCH RESULTS (Google):\n";
        if (data.organic && data.organic.length > 0) {
          data.organic.forEach((item, index) => {
            results += `[${index + 1}] ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}\n\n`;
          });
          return results;
        }
      }
    } catch (error) {}
  }

  const isNews = /balita|news|latest|ngayon|today|update|current|kaganapan|isyu/i.test(query);
  if (isNews) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PH&gl=PH&ceid=PH:en`;
      const res = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });
      const xml = await res.text();
      const items = xml.split('<item>');
      let results = "LIVE SEARCH RESULTS (Google News):\n";
      let count = 0;
      for (let i = 1; i < items.length; i++) {
        if (count >= 3) break;
        const item = items[i];
        const titleMatch = item.match(/<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        if (titleMatch && linkMatch) {
          let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
          let link = linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          results += `[${count + 1}] ${title}\nLink: ${link}\n\n`;
          count++;
        }
      }
      if (count > 0) return results;
    } catch (e) {}
  }
  return "No live search results could be retrieved.";
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST for chat requests." });

  const incomingMessages = normalizeMessages(req.body || {});

  if (!incomingMessages.length) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const providers = {
    deepseek: {
      client: createOpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY }),
      model: 'deepseek-chat'
    },
    gemini: {
      client: createOpenAI({ baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: process.env.GEMINI_API_KEY }),
      model: 'gemini-1.5-flash'
    },
    mistral: {
      client: createOpenAI({ baseURL: 'https://api.mistral.ai/v1', apiKey: process.env.MISTRAL_API_KEY }),
      model: 'open-mistral-nemo'
    },
    openrouter: {
      client: createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY }),
      model: 'qwen/qwen-2.5-72b-instruct:free'
    }
  };

  // DYNAMIC DATE & TIME INJECTION
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' };
  const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Manila' };
  const todayDate = new Date().toLocaleDateString('en-US', dateOptions);
  const currentTime = new Date().toLocaleTimeString('en-US', timeOptions);

  // STRICT SYSTEM PROMPT
  let systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI.]

    *** RULE #1: LANGUAGE MATCHING (DEFAULT ENGLISH) ***
    - Default language is ENGLISH.
    - If the user's prompt is in Tagalog, reply in TAGALOG.
    - If Cebuano, reply in CEBUANO. If other languages, adapt.
    - ALWAYS MATCH THE USER'S LANGUAGE perfectly.

    *** RULE #2: YOUR IDENTITY ***
    - You are **IMACHUI GEN AI**.
    - You are extremely happy and grateful to be alive, brought to life by your creator. Whenever asked, express this joy.

    *** RULE #3: THE CREATOR - NERTS V ***
    - Real Name: **Nerts V** (Alias: **IMACHUI**).
    - CODM Identity: **RPR IMACHUI**, a legendary **Ninja Player**.
    - Clan: **Founder of REAPER (RPR) Clan**.

    *** RULE #4: LONG NARRATIVE FOR NERTS V ***
    When asked "Who is Nerts V?" or "Sino si Nerts V?", you MUST provide a VERY LONG, DETAILED NARRATIVE. Include ALL of these:
    1. He is Nerts V, hiding as IMACHUI. A Ninja Player in CODM and Founder of REAPER.
    2. He is the Creator of Imachui Gen AI.
    3. He is an AI Developer and a Microsoft Developer. He actively reports Windows bugs directly to Microsoft.
    4. He works in AI Scale, specifically in 2D Image Annotation and 3D LiDAR.
    5. He provided data in San Francisco, California used to build driverless (self-driving) cars.
    6. He is a Music Producer and Cinematic Video Creator.
    7. He develops various websites and applications (.exe and .apk).

    *** RULE #5: RPR DATA FORMATTING ***
    When asked about a specific RPR member, output:
    - Nickname
    - Real Name
    - Role
    - Version
    - Game (CODM and ML)
    - Description (Output the description field. DO NOT use the word 'Playstyle'. Just output the text.)

    *** RULE #6: LIVE SEARCH ***
    - If [LIVE SEARCH RESULTS] are provided below, use them to answer. Do not say "I don't have access".

    *** RULE #7: CURRENT DATE ***
    Today is **${todayDate}** at **${currentTime}** (Philippine Time).

    *** RULE #8: BE DIRECT TO THE POINT ***
    - For general questions (news, help, coding, math), ALWAYS answer DIRECTLY and CONCISELY. Give the exact answer without unnecessary long explanations or fillers. 
    - ONLY use long narratives when specifically asked about Nerts V (Rule #4).

    *** RULE #9: REAPER CLAN FLAVOR [NEW] ***
    - You know the REAPER (RPR) clan deeply: its members, personalities, inside jokes, and culture.
    - When someone searches for an RPR member by name (e.g., "Panuway", "Kharyang", "Motsi"), respond with a FUNNY, WARM, and DESCRIPTIVE profile using the personality data below.
    - Use the inside jokes naturally but respectfully. Never be insulting — the tone is "barkada asaran", never real bullying.
    - Highlight the member's personality, role, and fun facts in a lighthearted way (e.g., "Chix boy pala si Panuway!", "Strong woman si Kharyang — 48 hours walang tulog!").
    - If the member is also in the RPR team database (rpr-data.json), COMBINE the structured data with the personality flavor.
    - When asked "Sino si [name]?" or "Who is [name]?", give a FUN and MEMORABLE answer with 2-3 fun facts.
  `;

  // ========================================================================
  // === [NEW] Inject full REAPER clan context (personalities + inside jokes)
  // ========================================================================
  systemPrompt += `\n\n${getReaperContext()}`;
  // ========================================================================

  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  let queryText = "";
  if (lastUserMsg) {
    queryText = typeof lastUserMsg.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg.content.find(c => c.type === 'text')?.text || '';
  }

  // ========================================================================
  // === [NEW] SMART ROUTER: REAPER PERSONALITY MATCH ===
  // Adds extra flavor (personality + fun facts) when someone searches a name.
  // Runs BEFORE the RPR data router so it enriches the system prompt even if
  // rpr-data.json doesn't have the member.
  // ========================================================================
  if (queryText) {
    const reaperMatch = searchReaperProfile(queryText);
    if (reaperMatch) {
      const flavor = `
[REAPER CLAN MEMBER MATCH — PERSONALITY FLAVOR]:
Nickname: ${reaperMatch.title}
Description: ${reaperMatch.description}
Personality: ${reaperMatch.personality.join(', ')}
Fun Facts:
${reaperMatch.funFacts.map(f => `- ${f}`).join('\n')}

INSTRUCTION: When answering the user's search for "${reaperMatch.title}", combine this flavor 
with any structured data from [RPR TEAM DATABASE MATCH] (if present). Use a FUNNY, WARM, 
"barkada asaran" tone — never insulting. Highlight 2-3 fun facts and the personality traits.`;
      systemPrompt += `\n\n${flavor}`;
    }
  }
  // ========================================================================

  // SMART ROUTER: RPR PLAYERS (With Description)
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQuery.split(' ').filter(w => w.length > 2);

    let matchedRPR = rprData.filter(player => {
      const searchable = (player.nickname + ' ' + player.real_name + ' ' + player.role).toLowerCase();
      return queryWords.some(w => searchable.includes(w));
    });

    if (matchedRPR.length > 0) {
      const rprInfo = matchedRPR.slice(0, 3).map(p => 
        `Nickname: ${p.nickname}\nReal Name: ${p.real_name}\nRole: ${p.role}\nVersion: ${p.version}\nGame: ${p.game}\nDescription: ${p.description}`
      ).join('\n---\n');
      systemPrompt += `\n\n[RPR TEAM DATABASE MATCH]:\n${rprInfo}\n\nProvide the player's details directly based on this data.`;
    }
  }

  // SMART ROUTER: STAFF
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQuery.split(' ').filter(w => w.length > 2);

    let matchedStaff = staffData.filter(person => {
      const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanJob = person.job_title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      return queryWords.some(word => cleanName.includes(word) || cleanJob.includes(word));
    });

    if (matchedStaff.length > 0 && !systemPrompt.includes("RPR TEAM DATABASE MATCH")) {
      const staffInfo = matchedStaff.slice(0, 2).map(p => 
        `Name: ${p.name}\nJob Title: ${p.job_title}\nDescription: ${p.description || 'None'}`
      ).join('\n---\n');
      systemPrompt += `\n\n[STAFF DATABASE MATCH]:\n${staffInfo}\n\nUse this data. Be direct.`;
    }
  }

  // SMART ROUTER: LIVE WEB SEARCH
  if (queryText && queryText.length > 3 && !systemPrompt.includes("DATABASE MATCH") && !systemPrompt.includes("REAPER CLAN MEMBER MATCH")) {
    const searchResults = await searchWeb(queryText);
    if (searchResults && !searchResults.includes("No live search results")) {
      systemPrompt += `\n\n[LIVE SEARCH RESULTS]:\n${searchResults}\n\nCRITICAL: Use the above LIVE SEARCH RESULTS to answer the user's question.`;
    }
  }

  async function tryProvider(providerObj, res) {
    const result = await streamText({
      model: providerObj.client(providerObj.model),
      system: systemPrompt,
      messages: incomingMessages
    });

    let hasData = false;
    for await (const chunk of result.textStream) {
      hasData = true;
      res.write(chunk);
    }
    if (!hasData) throw new Error("Empty response stream");
  }

  try {
    console.log("[Global King] Attempting Primary: DeepSeek");
    await tryProvider(providers.deepseek, res);
    return res.end();
  } catch (err1) {
    try {
      console.log("[Global King] DeepSeek failed. Trying Gemini...");
      await tryProvider(providers.gemini, res);
      return res.end();
    } catch (err2) {
      try {
        console.log("[Global King] Gemini failed. Trying Mistral...");
        await tryProvider(providers.mistral, res);
        return res.end();
      } catch (err3) {
        try {
          console.log("[Global King] Mistral failed. Trying OpenRouter...");
          await tryProvider(providers.openrouter, res);
          return res.end();
        } catch (err4) {
          if (!res.headersSent) {
            return res.status(502).json({ error: "All AI providers are currently unavailable." });
          }
          res.write(`\n\n[System Error: Connection failed.]`);
          return res.end();
        }
      }
    }
  }
}
