// Technology Trivia expansion — Easy grade, first curated batch.
// Existing technology questions remain in data/nigeriaTrivia.js.
// Every new record has a stable ID, four distinct options, a valid answer index,
// a review date and a source reference.
export const TECHNOLOGY_TRIVIA = [
  {
    id: 'tx001',
    category: 'tech',
    difficulty: 'easy',
    question: 'What does the abbreviation URL stand for?',
    options: ['Uniform Resource Locator', 'Universal Routing Link', 'User Reference Location', 'Unified Resource Language'],
    answer: 0,
    reviewedAt: '2026-11-06',
    source: 'https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/What_is_a_URL'
  },
  {
    id: 'tx002',
    category: 'tech',
    difficulty: 'easy',
    question: 'What is the primary purpose of a web browser?',
    options: ['To manufacture computer hardware', 'To access and display web pages', 'To replace an operating system', 'To provide electricity to a router'],
    answer: 1,
    reviewedAt: '2026-11-06',
    source: 'https://www.mozilla.org/en-US/firefox/browsers/what-is-a-browser/'
  },
  {
    id: 'tx003',
    category: 'tech',
    difficulty: 'easy',
    question: 'Which type of software manages a computer’s hardware and provides a platform for applications?',
    options: ['Spreadsheet', 'Search engine', 'Operating system', 'Image file'],
    answer: 2,
    reviewedAt: '2026-11-06',
    source: 'https://www.britannica.com/technology/operating-system'
  },
  {
    id: 'tx004',
    category: 'tech',
    difficulty: 'easy',
    question: 'What does HTTPS primarily help protect when information travels between a browser and a website?',
    options: ['The physical screen from damage', 'The computer from every possible virus', 'The website from being redesigned', 'The connection by encrypting data in transit'],
    answer: 3,
    reviewedAt: '2026-11-06',
    source: 'https://developer.mozilla.org/en-US/docs/Glossary/HTTPS'
  },
  {
    id: 'tx005',
    category: 'tech',
    difficulty: 'easy',
    question: 'What is Wi-Fi commonly used for?',
    options: ['Connecting devices to a network wirelessly', 'Charging every device without electricity', 'Increasing a screen’s resolution', 'Translating spoken languages offline'],
    answer: 0,
    reviewedAt: '2026-11-06',
    source: 'https://www.wi-fi.org/discover-wi-fi'
  },
  {
    id: 'tx006',
    category: 'tech',
    difficulty: 'easy',
    question: 'What kind of code is a QR code?',
    options: ['A computer operating system', 'A two-dimensional barcode', 'A type of internet cable', 'A digital audio format'],
    answer: 1,
    reviewedAt: '2026-11-06',
    source: 'https://www.iso.org/standard/62021.html'
  },
  {
    id: 'tx007',
    category: 'tech',
    difficulty: 'easy',
    question: 'Which technology is designed for short-range wireless communication between devices such as phones and headphones?',
    options: ['GPS', 'Ethernet', 'Bluetooth', 'Fibre-optic broadband'],
    answer: 2,
    reviewedAt: '2026-11-06',
    source: 'https://www.bluetooth.com/learn-about-bluetooth/tech-overview/'
  },
  {
    id: 'tx008',
    category: 'tech',
    difficulty: 'easy',
    question: 'When a person saves files to a cloud-storage service, where are the files generally stored?',
    options: ['Only inside the phone’s SIM card', 'Inside the monitor', 'On a paper printout', 'On remote servers accessed over a network'],
    answer: 3,
    reviewedAt: '2026-11-06',
    source: 'https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/what-is-cloud-storage'
  },
  {
    id: 'tx009',
    category: 'tech',
    difficulty: 'easy',
    question: 'What does USB stand for?',
    options: ['Universal Serial Bus', 'Unified System Board', 'Universal Storage Battery', 'User Signal Bridge'],
    answer: 0,
    reviewedAt: '2026-11-06',
    source: 'https://www.usb.org/'
  },
  {
    id: 'tx010',
    category: 'tech',
    difficulty: 'easy',
    question: 'What is the main security benefit of multi-factor authentication?',
    options: ['It makes every password public', 'It requires more than one type of evidence to verify a sign-in', 'It removes the need for software updates', 'It guarantees that a device cannot be lost'],
    answer: 1,
    reviewedAt: '2026-11-06',
    source: 'https://www.cisa.gov/secure-our-world/use-strong-passwords'
  }
];
