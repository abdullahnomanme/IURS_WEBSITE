// Seed content extracted verbatim from the original static IURS pages.
// Nothing here is invented; every row mirrors what was already published.
// Seeding is idempotent and runs only while a table is still empty, so photos
// an administrator deletes never come back. Two entries may legitimately point
// at the same photograph, so gallery keys include the row position.

export const GALLERY_SEED = [
  { category: "Events", image_url: "assets/workshop-group-main.webp", title: "Freshers’ Reception & Research Workshop 2025", caption: "Research orientation programme", fit: "cover" },
  { category: "Events", image_url: "assets/event-unveiling-seminar.jpg", title: "The Unveiling: Research Insights & Leadership Transition", caption: "Seminar • 12 August 2025", fit: "cover" },
  { category: "Events", image_url: "assets/award-moment.webp", title: "Award Presentation at Research Workshop", caption: "Award & recognition", fit: "cover" },
  { category: "Community", image_url: "assets/outdoor-research-group.webp", title: "Outdoor Research & Networking Activity", caption: "IURS community activity", fit: "cover" },
  { category: "Achievements", image_url: "assets/research-seminar.webp", title: "Research Seminar & Recognition", caption: "Research seminar", fit: "cover" },
  { category: "Events", image_url: "assets/orientation-research-methodology.jpg", title: "Orientation to Research Methodology", caption: "Event • 03 May 2026", fit: "cover" },
  { category: "Training", image_url: "assets/smart-office-extended-poster.jpg", title: "Smart Office Tools for University Students", caption: "Training promotion • February 2026", fit: "contain" },
  { category: "Achievements", image_url: "assets/best-paper-award.jpg", title: "Best Paper Award — NET INSEARCH International Conference", caption: "IURS member achievement", fit: "contain" },
  { category: "Community", image_url: "assets/recruitment-4.1.jpg", title: "Member Recruitment 4.1", caption: "Membership campaign", fit: "contain" },
  { category: "Events", image_url: "assets/webinar-study-europe.jpg", title: "Study in Europe: Opportunities, Admissions & Scholarships", caption: "Webinar • 04 February 2026", fit: "cover" },
  { category: "Training", image_url: "assets/smart-office-tools-2026.jpg", title: "Smart Office Tools for University Students", caption: "Training • February 2026", fit: "contain" },
  { category: "Community", image_url: "assets/group-field-day-2025.jpg", title: "IURS Members — Group Activity", caption: "03 May 2025", fit: "cover" },
  { category: "Research", image_url: "assets/session-circle-1.jpg", title: "Research Circle & Campus Discussion", caption: "IURS activity", fit: "cover" },
  { category: "Research", image_url: "assets/research-circle-activity-2.jpg", title: "Research Circle & Campus Discussion", caption: "IURS activity", fit: "cover" },
  { category: "Research", image_url: "assets/session-circle-3.jpg", title: "Research Circle & Campus Discussion", caption: "IURS activity", fit: "cover" },
  { category: "Community", image_url: "assets/research-group-standing-2.jpg", title: "IURS Members on Campus", caption: "IURS community", fit: "cover" },
  { category: "Campus", image_url: "assets/campus-building.jpg", title: "Islamic University Campus", caption: "Campus", fit: "cover" },
  { category: "Campus", image_url: "assets/campus-monument.jpg", title: "Islamic University Campus Monument", caption: "Campus", fit: "cover" },
  { category: "Campus", image_url: "assets/campus-pathway-2.jpg", title: "Campus Pathway", caption: "Campus", fit: "cover" },
  { category: "Documents", image_url: "assets/committee-approval-page-1.jpg", title: "Executive Committee 2025–2026 — Official Document", caption: "Approved committee roster", fit: "contain" },
  { category: "Documents", image_url: "assets/committee-approval-page-2.jpg", title: "Executive Committee 2025–2026 — Official Document", caption: "Approved committee roster", fit: "contain" },
  { category: "Events", image_url: "assets/orientation-research-methodology.jpg", title: "Orientation to Research Methodology", caption: "Event poster", fit: "cover" },
  { category: "Events", image_url: "assets/workshop-brand-poster.webp", title: "Be the Brand: Position Yourself to Open Doors", caption: "Training / Career poster", fit: "cover" },
  { category: "Events", image_url: "assets/workshop-speaker.webp", title: "Research Workshop Speaker Session", caption: "Research workshop", fit: "cover" },
  { category: "Events", image_url: "assets/workshop-audience.webp", title: "Freshers’ Reception & Research Workshop", caption: "Event audience", fit: "cover" },
  { category: "Community", image_url: "assets/workshop-group-1.webp", title: "IURS Research Team & Participants", caption: "Community & networking", fit: "cover" },
  { category: "Training", image_url: "assets/publishing-workshop.webp", title: "Navigating the Path to Publishing in International Indexed Journals", caption: "Academic publishing workshop", fit: "cover" },
  { category: "Community", image_url: "assets/meeting-room.webp", title: "IURS Academic Meeting", caption: "Academic coordination", fit: "cover" },
  { category: "Training", image_url: "assets/online-research-session.webp", title: "Online Research Session", caption: "Online academic session", fit: "cover" },
  { category: "Achievements", image_url: "assets/research-fundamentals-workshop.webp", title: "Research Programme & Certificate Moment", caption: "Achievement & recognition", fit: "cover" },
  { category: "Training", image_url: "assets/research-fundamentals-workshop.webp", title: "Workshop on Research Fundamentals", caption: "Research skills workshop", fit: "cover" },
  { category: "Training", image_url: "assets/research-fundamentals-slide.webp", title: "Research Fundamentals Session", caption: "Research fundamentals presentation", fit: "cover" },
];

export const TRAINING_SEED = [
  { seed_key: "seed-1", title: "Smart Office Tools for University Students", trainer: "S. M. Shahriar Shadhin",
    description: null, date_label: "Classes started 25 February 2026", image_url: "assets/smart-office-tools-2026.jpg" },
  { seed_key: "seed-2", title: "Orientation to Research Methodology", trainer: "Professor Mohammed Asaduzzaman, PhD",
    description: null, date_label: "03 May 2026", image_url: "assets/orientation-research-methodology.jpg" },
  { seed_key: "seed-3", title: "Smart Office Tools — Registration Extended", trainer: null,
    description: "Certificate-oriented student training", date_label: "February 2026", image_url: "assets/smart-office-extended-poster.jpg" },
  { seed_key: "seed-4", title: "Freshers’ Reception & Research Workshop 2025", trainer: null,
    description: "Research orientation, talks, recognition and networking", date_label: "2025", image_url: "assets/workshop-group-main.webp" },
  { seed_key: "seed-5", title: "Navigating the Path to Publishing in International Indexed Journals", trainer: null,
    description: "Academic publishing workshop for emerging researchers", date_label: "2025", image_url: "assets/publishing-workshop.webp" },
  { seed_key: "seed-6", title: "Workshop on Research Fundamentals", trainer: null,
    description: "Research fundamentals training and practical guidance", date_label: "2025", image_url: "assets/research-fundamentals-workshop.webp" },
];

/* ---------------------------------------------------------------------------
   Executive committee 2025-2026 and the seven research outputs, both taken
   VERBATIM from the pages that were already live. Nothing here is invented.
   Both lists load only while their table is still empty, so anything an
   administrator later edits or removes is never re-created.
   --------------------------------------------------------------------------- */
export const COMMITTEE_SEED = {
  label: '2025-2026',
  description: 'The 29-member executive committee leading IURS for the term 2025-2026.',
  reference: 'Ref: 2025-26/01  |  Dated: 12 August 2025',
};

export const EXECUTIVE_SEED = [
  {tier:'leadership',sl_no:1,designation:'President',name:'Taqy Wasif',department:'Economics'},
  {tier:'leadership',sl_no:2,designation:'Vice-President',name:'Farhana Sadika Supti',department:'Development Studies'},
  {tier:'leadership',sl_no:3,designation:'Vice-President',name:'Saqib Aslam',department:'Social Welfare'},
  {tier:'leadership',sl_no:4,designation:'Vice-President',name:'Md. Khairul Islam',department:'Economics'},
  {tier:'leadership',sl_no:5,designation:'General Secretary',name:'Elmu Kabir Rafa',department:'Pharmacy'},
  {tier:'leadership',sl_no:6,designation:'Joint Secretary',name:'Sabakunnaher Khusbu',department:'Environmental Science and Geography'},
  {tier:'leadership',sl_no:7,designation:'Joint Secretary',name:'Atikur Rahman',department:'Dawah and Islamic Studies'},
  {tier:'leadership',sl_no:8,designation:'Joint Secretary',name:'Nusrat Jahan Mitu',department:'Geography & Environment'},
  {tier:'roster',sl_no:5,designation:'Organizing Secretary',name:'Shohorab Uddin Ahmmed',department:'Al-Fiqh and Law'},
  {tier:'roster',sl_no:6,designation:'Assistant Organizing Secretary',name:'Hasib Mia',department:'Environmental Science and Geography'},
  {tier:'roster',sl_no:7,designation:'Treasurer',name:'Fahim Faisal',department:'Arabic Language and Literature'},
  {tier:'roster',sl_no:8,designation:'Assistant Treasurer',name:'Sadia Sabrina',department:'Social Welfare'},
  {tier:'roster',sl_no:9,designation:'Office Secretary',name:'Abdullah Al Noman',department:'Public Administration'},
  {tier:'roster',sl_no:10,designation:'Assistant Office Secretary',name:'Kazi Fataha Asmia Ardi',department:'Social Welfare'},
  {tier:'roster',sl_no:11,designation:'Human Resource Secretary',name:'Afia Alam',department:'Social Welfare'},
  {tier:'roster',sl_no:12,designation:'Assistant Human Resource Secretary',name:'Md. Masrur Rahman',department:'Physical Education and Sports Science'},
  {tier:'roster',sl_no:13,designation:'Research and Development Secretary',name:'Md. Mahafujur Rahman',department:'Applied Nutrition and Food Technology'},
  {tier:'roster',sl_no:14,designation:'Assistant Research and Development Secretary',name:'Mst. Mariom Akter Chaity',department:'Economics'},
  {tier:'roster',sl_no:15,designation:'International Affairs',name:'Abdul Halim',department:'Arabic Language and Literature'},
  {tier:'roster',sl_no:16,designation:'Branding and Promotion Secretary',name:'Shahriar Shadhin',department:'Biomedical Engineering'},
  {tier:'roster',sl_no:17,designation:'Assistant Branding and Promotion Secretary',name:'Samy Mohammad Samdany',department:'Finance and Banking'},
  {tier:'roster',sl_no:18,designation:'Public Relation and Networking Secretary',name:'Maruf Hasan',department:'Development Studies'},
  {tier:'roster',sl_no:19,designation:'Assistant Public Relation and Networking Secretary',name:'Maruf Islam Atik',department:'Marketing'},
  {tier:'roster',sl_no:20,designation:'Event Management Secretary',name:'Shurovi Yasmin',department:'Political Science'},
  {tier:'roster',sl_no:21,designation:'Assistant Event Management Secretary',name:'Aklima Akter Jhumur',department:'Human Resource Management'},
  {tier:'roster',sl_no:22,designation:'Event Presentation Secretary',name:'Mohima Khan',department:'Folklore'},
  {tier:'roster',sl_no:23,designation:'Project Management Secretary',name:'Sharmin Akter Swarna',department:'Public Administration'},
  {tier:'roster',sl_no:24,designation:'Assistant Project Management Secretary',name:'MD Tawhidul Islam',department:'Environmental Science'},
  {tier:'roster',sl_no:25,designation:'Higher Study and Scholarship Secretary',name:'Imtiaj Uddin Sajid',department:'EEE'},
  {tier:'roster',sl_no:26,designation:'IT Secretary',name:'Jarin Akter Mim',department:'Economics'},
  {tier:'roster',sl_no:27,designation:'Assistant IT Secretary',name:'Sumaya Tasnim Shimu',department:'Environmental Science'},
  {tier:'roster',sl_no:28,designation:'Corporate Affairs Secretary',name:'Zarin Tasmia',department:'Social Welfare'},
  {tier:'roster',sl_no:29,designation:'Information Secretary',name:'Kanis Fatema Kanon',department:'Economics'}
];

export const PUBLICATION_SEED = [
  {seed_key:'pub:0',category:'peer_reviewed',type_label:'Peer-reviewed Journal Article',title:'Field-Calibrated Threshold-Distance Assessment of Lead Dispersion from Controlled Lead-Acid Battery Plate Combustion',authors:'Md. Shaheduzzaman Roky · Md. Hasib Mia · Subroto Kumar · Mst. Shahanaz Islam Hira · Shahat Shiddiqe · Mahadi Hasan · Asad Ud-Daula',journal:'Environmental Pollution · Volume 408 · Article 128853 · Online 1 Aug 2026',publication_year:2026,doi:null,url:'https://www.sciencedirect.com/science/article/abs/pii/S0269749126012236?via%3Dihub',abstract:'Latest IURS-associated journal publication on lead dispersion and environmental food-safety risks around controlled lead-acid battery plate combustion.',sort_order:0},
  {seed_key:'pub:1',category:'peer_reviewed',type_label:'Peer-reviewed Journal Article',title:'Women’s Leadership in Higher Education in Bangladesh: Public and Private University Perspectives',authors:'Mohammed Asaduzzaman · Aklima Akter Puthi · Porna Dey · Farjana Bari',journal:'Public Organization Review · Volume 25 · pp. 1389–1406 · Published 23 May 2025',publication_year:2025,doi:'https://doi.org/10.1007/s11115-025-00864-7',url:'https://link.springer.com/article/10.1007/s11115-025-00864-7',abstract:'Mixed-methods research examining women’s leadership, institutional barriers, and policy needs across public and private higher education in Bangladesh.',sort_order:1},
  {seed_key:'pub:2',category:'peer_reviewed',type_label:'Peer-reviewed Journal Article',title:'Anti-cancer activity elucidation of geissolosimine as an MDM2-p53 interaction inhibitor: An in-silico study',authors:'Md. Al-Amin · Rehnuma Tanjin · Md. Rasul Karim · Jannatul Mawa Etee · Ayesha Siddika · Nafisa Akter · Md. Helal Uddin · Ratul Mahmud · Tasfia Saffat · Md. Faruk Hossen · Samira Idris Mowlee · Elmu Kabir Rafa · Sumi Akter',journal:'PLOS ONE · 20(5) · e0323003 · Published 8 May 2025',publication_year:2025,doi:'https://doi.org/10.1371/journal.pone.0323003',url:'https://pubmed.ncbi.nlm.nih.gov/40339040/',abstract:'Computational study from the Department of Pharmacy, Islamic University, investigating geissolosimine as a potential MDM2-p53 interaction inhibitor.',sort_order:2},
  {seed_key:'pub:3',category:'peer_reviewed',type_label:'Peer-reviewed Journal Article',title:'The Synergy of Leadership and Team Effectiveness: An Empirical Study at Islamic University\'s Non-Profit Organization',authors:'Dr. Md. Golam Mohiuddin · Md. Jobaer Hossain Bhuiya · Sazzad Hossain · Mst. Tanima Tasnim · Md. Tuhin Hossain',journal:'International Journal of Innovative Science and Research Technology · Volume 9 · Issue 11 · November 2024',publication_year:2024,doi:'https://doi.org/10.38124/ijisrt/IJISRT24NOV150',url:'https://www.ijisrt.com/the-synergy-of-leadership-and-team-effectiveness-an-empirical-study-at-islamic-universitys-nonprofit-organization',abstract:'Empirical research examining the relationship between leadership and team effectiveness in the context of Islamic University’s non-profit organization.',sort_order:3},
  {seed_key:'pub:4',category:'conference',type_label:'Conference Paper',title:'Reducing Operational Complexity Through E-Governance: A Case Study on Islamic University, Kushtia',authors:'IURS research output',journal:'10th International Integrative Research Conference · BARD, Cumilla · 2025',publication_year:2025,doi:null,url:'https://www.google.com/search?q=%22Reducing+Operational+Complexity+Through+E-Governance%22',abstract:'Conference research on e-governance and administrative simplification at Islamic University.',sort_order:4},
  {seed_key:'pub:5',category:'conference',type_label:'Research Paper',title:'From Waste to Resource: Recycling and Circular Economy Practices among University Students in Bangladesh',authors:'IURS research output',journal:'Mixed-methods study · Islamic University, Kushtia · 2025',publication_year:2025,doi:null,url:'https://www.google.com/search?q=%22From+Waste+to+Resource%22+%22Islamic+University%22',abstract:'Research on circular-economy awareness, recycling practices, barriers, motivators, and student-led sustainability initiatives.',sort_order:5},
  {seed_key:'pub:6',category:'conference',type_label:'Conference Paper',title:'Electoral Reform in Transitional Democracies: Blueprints from Tunisia, Sri Lanka, and Sudan for Democratic Renewal in Bangladesh',authors:'Abdullah Al Noman · Tanha Abina · Ezaz Ahmed',journal:'Conference research · 2025',publication_year:2025,doi:null,url:'https://www.google.com/search?q=%22Electoral+Reform+in+Transitional+Democracies%22+Bangladesh',abstract:'Comparative research on electoral reform lessons from transitional democracies and their relevance to democratic renewal in Bangladesh.',sort_order:6}
];
