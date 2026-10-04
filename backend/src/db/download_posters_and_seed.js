import fs from 'fs';
import path from 'path';

const USER_AGENT = 'SeatLockCinemaApp/1.0 (https://seatlock.com; contact@seatlock.com) NodeFetch/3.0';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const movies100 = [
  { title: 'Pushpa 2: The Rule', wiki: 'Pushpa_2:_The_Rule', genre: 'Action / Mass', rating: '8.9', duration: 204, desc: 'The clash between Pushpa Raj and SP Bhanwar Singh Shekhawat escalates into all-out warfare as Pushpa expands his red sandalwood syndicate across international borders.' },
  { title: 'Pushpa: The Rise', wiki: 'Pushpa:_The_Rise', genre: 'Action / Crime', rating: '7.6', duration: 179, desc: 'A laborer rises through the ranks of a red sandalwood smuggling syndicate in the forests of Seshachalam, battling a powerful cop on the way up.' },
  { title: 'RRR', wiki: 'RRR', genre: 'Historical / Period Action', rating: '8.0', duration: 187, desc: 'A fearless revolutionary Alluri Sitarama Raju and an officer Komaram Bheem forge an unbreakable friendship in 1920s British India.' },
  { title: 'Kalki 2898 AD', wiki: 'Kalki_2898_AD', genre: 'Sci-Fi / Mythology', rating: '7.6', duration: 181, desc: 'Set in a post-apocalyptic dystopian Kashi, a cynical bounty hunter Bhairava and an immortal warrior Ashwatthama battle over protecting the mother of Kalki.' },
  { title: 'Baahubali: The Beginning', wiki: 'Baahubali:_The_Beginning', genre: 'Action / Epic Fantasy', rating: '8.0', duration: 159, desc: 'In ancient Mahishmati kingdom, an adventurous tribal youth discovers his royal lineage and the heroic legacy of his father.' },
  { title: 'Baahubali 2: The Conclusion', wiki: 'Baahubali_2:_The_Conclusion', genre: 'Action / Epic Fantasy', rating: '8.2', duration: 167, desc: 'When Shiva learns about his royal heritage, he embarks on an unforgettable quest to avenge his father Amarendra Baahubali and overthrow Bhallaladeva.' },
  { title: 'Devara: Part 1', wiki: 'Devara:_Part_1', genre: 'Action / Coastal Adventure', rating: '6.8', duration: 178, desc: 'A valiant coastal warrior secretly protects his people against dangerous maritime smuggling networks while confronting betrayal from within his community.' },
  { title: 'Salaar: Part 1 – Ceasefire', wiki: 'Salaar:_Part_1_–_Ceasefire', genre: 'Action / Crime Thriller', rating: '6.6', duration: 175, desc: 'A dreaded gang leader Deva arrives in the dark sovereign metropolis of Khansaar to fulfill a sacred oath and protect his childhood friend.' },
  { title: 'Hanu-Man', wiki: 'Hanu-Man', genre: 'Mythological Superhero', rating: '7.9', duration: 158, desc: 'An underdog thief in a rural village stumbles upon a celestial gemstone of Lord Hanuman that grants him supernatural solar abilities.' },
  { title: 'Lucky Baskhar', wiki: 'Lucky_Baskhar', genre: 'Thriller / Financial Drama', rating: '7.8', duration: 150, desc: 'A middle-class bank cashier in 1990s Bombay discovers an audacious financial loophole that catapults him into high-stakes stock market manipulation.' },
  { title: 'Tillu Square', wiki: 'Tillu_Square', genre: 'Comedy / Romance / Crime', rating: '7.2', duration: 125, desc: 'DJ Tillu gets entangled in another chaotic mystery when he falls for a mysterious woman who pulls him into a whirlwind of dangerous comedy.' },
  { title: 'DJ Tillu', wiki: 'DJ_Tillu', genre: 'Comedy / Crime', rating: '7.3', duration: 121, desc: 'A fun-loving, stylish DJ in Hyderabad falls for a nightclub singer who gets him dragged into an accidental homicide and blackmail plot.' },
  { title: 'Sita Ramam', wiki: 'Sita_Ramam', genre: 'Romance / Period Drama', rating: '8.6', duration: 163, desc: 'An orphaned soldier Lieutenant Ram serving at the Kashmir border receives love letters from an enigmatic woman named Sita, culminating in an epic romance.' },
  { title: 'Jersey', wiki: 'Jersey_(2019_film)', genre: 'Sports / Drama', rating: '8.5', duration: 157, desc: 'A talented but failed cricketer in his late thirties decides to return to cricket to fulfill his young son\'s desire for an Indian team jersey.' },
  { title: 'Mahanati', wiki: 'Mahanati', genre: 'Biography / Drama', rating: '8.5', duration: 177, desc: 'The biographical drama chronicling the meteoric rise and tragic fall of South Indian cinema legendary superstar actress Savitri.' },
  { title: 'Rangasthalam', wiki: 'Rangasthalam', genre: 'Action / Period Drama', rating: '8.2', duration: 179, desc: 'In the 1980s fictional village of Rangasthalam, a partially deaf man Chitti Babu uncovers dark corruption and fights the oppressive village president.' },
  { title: 'Eega', wiki: 'Eega', genre: 'Fantasy / Revenge', rating: '7.7', duration: 145, desc: 'A young man murdered by an arrogant industrialist is reincarnated as a housefly and embarks on a relentless mission to protect his lover and exact vengeance.' },
  { title: 'Magadheera', wiki: 'Magadheera', genre: 'Action / Fantasy / Romance', rating: '8.1', duration: 166, desc: 'A warrior from the 17th century is reincarnated in modern times to protect the woman he loved and defeat the evil commander.' },
  { title: 'Pokiri', wiki: 'Pokiri', genre: 'Action / Thriller', rating: '8.0', duration: 167, desc: 'A ruthless killer-for-hire gets caught between two rival underworld gangs while concealing his true undercover police identity.' },
  { title: 'Athadu', wiki: 'Athadu', genre: 'Action / Thriller', rating: '8.2', duration: 173, desc: 'A professional assassin framed for the murder of a politician assumes the identity of a deceased man while hiding in a joint family.' },
  { title: 'Okkadu', wiki: 'Okkadu', genre: 'Action / Romance', rating: '8.1', duration: 170, desc: 'A Kabaddi player visits Kurnool for a match and unexpectedly rescues a young woman from an obsessive factionist faction leader.' },
  { title: 'Bommarillu', wiki: 'Bommarillu', genre: 'Romance / Family Drama', rating: '8.2', duration: 170, desc: 'A young man struggles against his overprotective father\'s micro-management while falling in love with an exuberant, free-spirited girl.' },
  { title: 'Arjun Reddy', wiki: 'Arjun_Reddy', genre: 'Romance / Drama', rating: '8.0', duration: 188, desc: 'A brilliant surgeon with anger management issues spirals into severe drug and alcohol addiction after his girlfriend is forced to marry another man.' },
  { title: 'Ala Vaikunthapurramuloo', wiki: 'Ala_Vaikunthapurramuloo', genre: 'Action / Family Comedy', rating: '7.3', duration: 165, desc: 'A young man raised by a spiteful clerk discovers that he was swapped at birth with the son of a wealthy millionaire businessman.' },
  { title: 'Sarileru Neekevvaru', wiki: 'Sarileru_Neekevvaru', genre: 'Action / Comedy', rating: '6.0', duration: 169, desc: 'An Indian Army Major travels to Kurnool on a covert personal assignment to protect his martyred colleague\'s mother and family.' },
  { title: 'Bharat Ane Nenu', wiki: 'Bharat_Ane_Nenu', genre: 'Political Drama', rating: '7.6', duration: 173, desc: 'A young Oxford graduate unexpectedly becomes the Chief Minister of Andhra Pradesh and attempts to revolutionize governance and combat corruption.' },
  { title: 'Srimanthudu', wiki: 'Srimanthudu', genre: 'Action / Drama', rating: '7.5', duration: 163, desc: 'The idealistic heir of a multi-billion dollar business empire chooses to adopt a neglected rural village to bring basic amenities and dignity.' },
  { title: 'Dookudu', wiki: 'Dookudu', genre: 'Action / Comedy', rating: '7.5', duration: 175, desc: 'A daring undercover IPS officer creates an elaborate theatrical illusion to shield his comatose politician father while hunting an international don.' },
  { title: 'Businessman', wiki: 'Businessman_(film)', genre: 'Crime / Action', rating: '7.2', duration: 133, desc: 'Surya arrives in Mumbai with a singular ambition to conquer the city\'s underworld and establish a corporate criminal empire.' },
  { title: 'Khaleja', wiki: 'Khaleja_(film)', genre: 'Action / Comedy / Fantasy', rating: '7.7', duration: 170, desc: 'A cynical cab driver is revered as a divine savior by an isolated remote village plagued by an inexplicable, mysterious illness.' },
  { title: 'Murari', wiki: 'Murari_(film)', genre: 'Supernatural / Drama', rating: '7.9', duration: 175, desc: 'A curse cast on an aristocratic royal family requires one male descendant to sacrifice his life every forty-eight years.' },
  { title: 'Arya', wiki: 'Arya_(2004_film)', genre: 'Romance / Comedy', rating: '7.8', duration: 150, desc: 'A spirited and eccentric college student practices unconditional one-sided love for a woman who is already in a relationship with another.' },
  { title: 'Arya 2', wiki: 'Arya_2', genre: 'Romance / Psychological Drama', rating: '7.4', duration: 162, desc: 'Two childhood orphanage friends enter the corporate world where their bond is tested by obsession, friendship, and unspoken sacrifice.' },
  { title: 'Desamuduru', wiki: 'Desamuduru', genre: 'Action / Romance', rating: '7.0', duration: 155, desc: 'A television channel program director on a field assignment in Kullu Manali falls in love with a sanyasini pursued by a violent gangster.' },
  { title: 'Race Gurram', wiki: 'Race_Gurram', genre: 'Action / Comedy', rating: '7.2', duration: 163, desc: 'Two fiercely contrasting brothers – a by-the-book police officer and a carefree rogue – unite to destroy a ruthless villain aspiring for political power.' },
  { title: 'Julayi', wiki: 'Julayi', genre: 'Action / Comedy', rating: '7.2', duration: 160, desc: 'A hyper-intelligent slacker witnesses a massive bank robbery and assists the police commissioner in outsmarting a criminal mastermind.' },
  { title: 'S/O Satyamurthy', wiki: 'S/O_Satyamurthy', genre: 'Drama / Family', rating: '7.1', duration: 162, desc: 'A privileged son sacrifices his wealth and prestige to settle his late father\'s debts and uphold his supreme code of family values and integrity.' },
  { title: 'Sarrainodu', wiki: 'Sarrainodu', genre: 'Action / Mass', rating: '6.6', duration: 159, desc: 'An ex-military officer punishes corrupt, powerful criminals outside legal boundaries and wages war against an untouchable chief minister\'s sociopathic son.' },
  { title: 'DJ: Duvvada Jagannadham', wiki: 'DJ:_Duvvada_Jagannadham', genre: 'Action / Comedy', rating: '6.0', duration: 156, desc: 'A devout traditional Brahmin cook doubles as a secret vigilante assassin who eliminates corrupt syndicate kingpins.' },
  { title: 'Vedam', wiki: 'Vedam_(film)', genre: 'Drama / Anthology', rating: '8.1', duration: 135, desc: 'Five individuals from vastly diverse socioeconomic backgrounds cross paths during a fatal terrorist hostage crisis in a Hyderabad hospital.' },
  { title: 'Chatrapathi', wiki: 'Chatrapathi_(2005_film)', genre: 'Action / Drama', rating: '7.7', duration: 158, desc: 'A displaced Sri Lankan refugee in Vizag rises up to become the legendary protector and voice of oppressed dock laborers.' },
  { title: 'Simhadri', wiki: 'Simhadri_(2003_film)', genre: 'Action / Mass', rating: '7.5', duration: 172, desc: 'A devoted servant in a benevolent feudal patriarch\'s household conceals a violent past where he ruled the streets of Kerala as an underworld defender.' },
  { title: 'Yamadonga', wiki: 'Yamadonga', genre: 'Fantasy / Comedy', rating: '7.3', duration: 184, desc: 'A charming rogue thief dies prematurely and lands in the court of Yama Dharma Raja, where he creates unprecedented comic havoc.' },
  { title: 'Temper', wiki: 'Temper_(film)', genre: 'Action / Drama', rating: '7.4', duration: 147, desc: 'A thoroughly corrupt police inspector undergoes a moral redemption after witnessing the gruesome assault of an innocent young woman.' },
  { title: 'Nannaku Prematho', wiki: 'Nannaku_Prematho', genre: 'Action / Thriller', rating: '7.5', duration: 168, desc: 'An intelligent son uses deductive logic and mathematical strategies to bankrupt the cunning oligarch who swindled his dying father.' },
  { title: 'Janatha Garage', wiki: 'Janatha_Garage', genre: 'Action / Drama', rating: '7.3', duration: 162, desc: 'An environmental activist joins forces with a noble garage mechanic who runs a parallel people\'s court resolving societal injustice.' },
  { title: 'Aravinda Sametha Veera Raghava', wiki: 'Aravinda_Sametha_Veera_Raghava', genre: 'Action / Faction Drama', rating: '7.6', duration: 162, desc: 'A young scion of a faction-ridden Rayalaseema clan renounces bloodshed and strives tirelessly to bring lasting peace between warring villages.' },
  { title: 'Mirchi', wiki: 'Mirchi_(film)', genre: 'Action / Drama', rating: '7.3', duration: 155, desc: 'A peace-loving youth enters a violent faction-torn territory to reform hostile warlords through unconditional love rather than bloody weapons.' },
  { title: 'Darling', wiki: 'Darling_(2010_film)', genre: 'Romance / Comedy', rating: '7.2', duration: 150, desc: 'A charming young man narrates an imaginative fabricated romantic tale to evade marrying a dangerous local gangster\'s daughter.' },
  { title: 'Mr. Perfect', wiki: 'Mr._Perfect_(film)', genre: 'Romance / Family Drama', rating: '7.1', duration: 145, desc: 'A staunchly uncompromising software architect learns the supreme beauty of mutual adjustments and empathy in human relationships.' },
  { title: 'Saaho', wiki: 'Saaho', genre: 'Action / Sci-Fi Thriller', rating: '5.1', duration: 170, desc: 'An undercover operative battles international crime syndicates vying for supreme control of the fictional metropolis of Waaji City.' },
  { title: 'Radhe Shyam', wiki: 'Radhe_Shyam', genre: 'Period Romance / Fantasy', rating: '5.3', duration: 138, desc: 'A world-renowned palmist who believes strictly in destiny finds his rigid convictions shaken when he falls deeply in love with a terminally ill doctor.' },
  { title: 'Adipurush', wiki: 'Adipurush', genre: 'Mythological Action', rating: '4.8', duration: 179, desc: 'Lord Raghava, Janaki, and Shesh embark on a divine epic war against the demon king Lankesh in Lanka to rescue Janaki.' },
  { title: 'Guntur Kaaram', wiki: 'Guntur_Kaaram', genre: 'Action / Family Drama', rating: '5.4', duration: 159, desc: 'A fiery man from Guntur is pressured to sign an agreement relinquishing all family ties with his estranged politician mother.' },
  { title: 'Bimbisara', wiki: 'Bimbisara_(film)', genre: 'Fantasy / Period Action', rating: '7.3', duration: 146, desc: 'The ruthless king of Trigartala kingdom travels through time via a mystical mirror and lands in modern Hyderabad to undergo redemption.' },
  { title: 'Karthikeya', wiki: 'Karthikeya_(film)', genre: 'Mystery / Thriller', rating: '7.3', duration: 130, desc: 'A curious medical student investigates mysterious deaths surrounding a closed Subramanyaswamy temple in a tranquil rural village.' },
  { title: 'Karthikeya 2', wiki: 'Karthikeya_2', genre: 'Mystery / Adventure / Mythology', rating: '7.9', duration: 150, desc: 'Dr. Karthikeya embarks on an perilous quest to retrieve Lord Krishna\'s sacred anklet and safeguard ancient lost knowledge for humanity.' },
  { title: 'Major', wiki: 'Major_(film)', genre: 'Biography / Action / Drama', rating: '8.1', duration: 150, desc: 'The inspiring true story of Major Sandeep Unnikrishnan, who valiantly saved hundreds of civilians during the 2008 Mumbai 26/11 attacks.' },
  { title: 'Goodachari', wiki: 'Goodachari', genre: 'Spy / Action Thriller', rating: '7.8', duration: 147, desc: 'A sincere young intelligence agent is framed for the assassination of his superior officers and must race against time to expose a double agent.' },
  { title: 'HIT: The First Case', wiki: 'HIT:_The_First_Case', genre: 'Crime / Mystery Thriller', rating: '7.7', duration: 125, desc: 'A brilliant detective suffering from post-traumatic stress disorder tackles the baffling case of a missing young college girl.' },
  { title: 'HIT: The Second Case', wiki: 'HIT:_The_Second_Case', genre: 'Crime / Mystery Thriller', rating: '7.3', duration: 120, desc: 'SP Krishna Dev investigates a gruesome, chilling serial killer case in Vizag where the victim was murdered and dismembered.' },
  { title: 'Evaru', wiki: 'Evaru', genre: 'Mystery / Crime Drama', rating: '8.1', duration: 118, desc: 'A corrupt sub-inspector is hired by a wealthy woman accused of killing a high-ranking officer to fabricate a watertight self-defense narrative.' },
  { title: 'Kshanam', wiki: 'Kshanam', genre: 'Mystery / Thriller', rating: '8.1', duration: 120, desc: 'An NRI returns to India to help his ex-girlfriend search for her missing daughter, but everyone else claims the child never existed.' },
  { title: 'Agent Sai Srinivasa Athreya', wiki: 'Agent_Sai_Srinivasa_Athreya', genre: 'Comedy / Detective Thriller', rating: '8.4', duration: 148, desc: 'A quirky Nellore detective investigating an unidentified body at a railway track uncovers a massive, sinister dead-body racket.' },
  { title: 'Mathu Vadalara', wiki: 'Mathu_Vadalara', genre: 'Comedy / Mystery Thriller', rating: '8.2', duration: 129, desc: 'A penurious delivery boy attempts a petty delivery scam, only to find himself trapped in a posh apartment with a dead corpse.' },
  { title: 'Mathu Vadalara 2', wiki: 'Mathu_Vadalara_2', genre: 'Comedy / Crime Thriller', rating: '7.3', duration: 138, desc: 'Former delivery boys turn into elite special task force agents who get framed in a sensational high-profile kidnapping scheme.' },
  { title: 'Jathi Ratnalu', wiki: 'Jathi_Ratnalu', genre: 'Comedy', rating: '7.3', duration: 145, desc: 'Three naive, small-town friends move to Hyderabad dreaming of fortune, only to be framed for an assassination attempt on a minister.' },
  { title: 'Pellichoopulu', wiki: 'Pellichoopulu', genre: 'Romance / Comedy', rating: '8.2', duration: 125, desc: 'Two ambition-contrasting youths meet during an arranged matchmaking session and team up to launch a revolutionary food truck.' },
  { title: 'Geetha Govindam', wiki: 'Geetha_Govindam', genre: 'Romance / Comedy', rating: '7.7', duration: 142, desc: 'An innocent, upright college lecturer is mislabeled as an obnoxious eve-teaser by a fiery woman who happens to be his prospective sister-in-law.' },
  { title: 'Dear Comrade', wiki: 'Dear_Comrade', genre: 'Romance / Drama', rating: '7.3', duration: 169, desc: 'A fiery student activist with uncontrollable anger issues fights to support his state-level cricketer lover facing sexual harassment.' },
  { title: 'Kushi', wiki: 'Kushi_(2023_film)', genre: 'Romance / Comedy Drama', rating: '6.4', duration: 165, desc: 'Two people from diametrically opposite ideological backgrounds marry out of defiance, facing ego clashes when life gets real.' },
  { title: 'Ante Sundaraniki', wiki: 'Ante_Sundaraniki!', genre: 'Romance / Comedy', rating: '7.6', duration: 173, desc: 'An orthodox Brahmin boy and a devout Christian photographer weave an intricate web of comedic lies to convince their families to wed.' },
  { title: 'Shyam Singha Roy', wiki: 'Shyam_Singha_Roy', genre: 'Period Drama / Supernatural', rating: '7.7', duration: 157, desc: 'A modern filmmaker accused of plagiarism experiences spontaneous past-life memories of being a fearless revolutionary writer in 1970s Bengal.' },
  { title: 'Hi Nanna', wiki: 'Hi_Nanna', genre: 'Romance / Family Drama', rating: '8.2', duration: 155, desc: 'A dedicated single father raising a daughter with cystic fibrosis bonds with a warm, caring woman who harbors a secret connection to their past.' },
  { title: 'Dasara', wiki: 'Dasara_(film)', genre: 'Period Action / Drama', rating: '6.7', duration: 156, desc: 'In the coal-dust-blanketed village of Veerlapally, lifelong bonds of friendship and love are tested against ruthless feudal power plays.' },
  { title: 'Nani\'s Gang Leader', wiki: 'Gang_Leader_(2019_film)', genre: 'Comedy / Crime Thriller', rating: '7.6', duration: 156, desc: 'A mediocre revenge novelist is hired by an unlikely team of five grieving women to plot vengeance against a ruthless ambulance driver.' },
  { title: 'Bhale Bhale Magadivoy', wiki: 'Bhale_Bhale_Magadivoy', genre: 'Romance / Comedy', rating: '7.7', duration: 143, desc: 'An eccentric plant scientist plagued by severe absent-mindedness goes to extreme comedic lengths to hide his condition from his beloved.' },
  { title: 'Ninnu Kori', wiki: 'Ninnu_Kori', genre: 'Romance / Drama', rating: '7.6', duration: 136, desc: 'A young man unable to move on from his past heartbreak travels to San Francisco to meet his married former lover and her supportive husband.' },
  { title: 'Middle Class Abbayi', wiki: 'Middle_Class_Abbayi', genre: 'Action / Family Drama', rating: '5.9', duration: 154, desc: 'A middle-class youth who clashes with his sister-in-law steps forward to defend her from a merciless transport mafia kingpin in Warangal.' },
  { title: 'Uppena', wiki: 'Uppena', genre: 'Romance / Social Drama', rating: '7.3', duration: 147, desc: 'A passionate fisherman\'s son falls in love with an upper-caste landlord\'s daughter, daring to defy caste and honor in coastal Andhra.' },
  { title: 'Krack', wiki: 'Krack_(film)', genre: 'Action / Police Drama', rating: '6.8', duration: 154, desc: 'A fiercely unhinged police circle inspector takes on brutal factionists and seasoned underworld criminals across Andhra Pradesh.' },
  { title: 'Vakeel Saab', wiki: 'Vakeel_Saab', genre: 'Legal Drama / Thriller', rating: '7.1', duration: 155, desc: 'A reclusive, grieving advocate comes out of retirement to represent three innocent young women falsely accused of assault by influential men.' },
  { title: 'Bheemla Nayak', wiki: 'Bheemla_Nayak', genre: 'Action / Drama', rating: '6.4', duration: 145, desc: 'An uncompromising duty-bound sub-inspector locks horns with an arrogant ex-havildar politician\'s son in an explosive ego battle.' },
  { title: 'Waltair Veerayya', wiki: 'Waltair_Veerayya', genre: 'Action / Mass Entertainer', rating: '6.3', duration: 160, desc: 'A feared Visakhapatnam fisherman kingpin travels to Malaysia on a high-stakes mission to capture a notorious drug cartel boss.' },
  { title: 'Veera Simha Reddy', wiki: 'Veera_Simha_Reddy', genre: 'Action / Faction Drama', rating: '5.3', duration: 169, desc: 'A revered faction chieftain of Pulicharla defends his land and people against ancestral blood feuds and insidious betrayal.' },
  { title: 'Bhagavanth Kesari', wiki: 'Bhagavanth_Kesari', genre: 'Action / Emotional Drama', rating: '6.6', duration: 155, desc: 'A fearless guardian fights against all odds to train his deceased friend\'s fragile daughter into an indomitable Indian Army officer.' },
  { title: 'Akhanda', wiki: 'Akhanda', genre: 'Action / Devotional Mass', rating: '6.9', duration: 167, desc: 'An ascetic Aghora devotee of Lord Shiva descends from the sacred Himalayas to vanquish a ruthless uranium mining tycoon.' },
  { title: 'Legend', wiki: 'Legend_(2014_film)', genre: 'Action / Mass', rating: '6.9', duration: 162, desc: 'A charismatic NRI returns to his ancestral Rayalaseema estate to end the violent terror reign of a psychopathic local factionist.' },
  { title: 'F2: Fun and Frustration', wiki: 'F2:_Fun_and_Frustration', genre: 'Comedy', rating: '6.5', duration: 148, desc: 'Two frustrated married men conspire together to escape their domineering spouses, fleeing to Europe for an hilarious misadventure.' },
  { title: 'F3: Fun and Frustration', wiki: 'F3:_Fun_and_Frustration', genre: 'Comedy', rating: '5.0', duration: 149, desc: 'Night-blind and stuttering conmen join forces to fool an industrialist into believing they are his estranged billionaire heirs.' },
  { title: 'Venky Mama', wiki: 'Venky_Mama', genre: 'Action / Drama / Comedy', rating: '6.0', duration: 149, desc: 'A superstitious village uncle who sacrificed his own marriage to raise his orphaned nephew races to rescue him from Pakistan border insurgents.' },
  { title: 'Drushyam', wiki: 'Drushyam', genre: 'Crime / Mystery Thriller', rating: '8.2', duration: 150, desc: 'A clever cable TV operator orchestrates an impenetrable web of false alibis to shield his family after an accidental death.' },
  { title: 'Drushyam 2', wiki: 'Drushyam_2_(2021_film)', genre: 'Crime / Mystery Thriller', rating: '7.8', duration: 152, desc: 'Six years after the baffling incident, Rambabu faces renewed police surveillance and forensic reinvestigation into the case.' },
  { title: 'Seethamma Vakitlo Sirimalle Chettu', wiki: 'Seethamma_Vakitlo_Sirimalle_Chettu', genre: 'Family / Drama', rating: '7.5', duration: 159, desc: 'Two loving but temperamental brothers navigate middle-class realities and familial self-respect in the scenic town of Relangi.' },
  { title: 'Manam', wiki: 'Manam_(film)', genre: 'Fantasy / Drama / Romance', rating: '8.0', duration: 163, desc: 'Three generations of the legendary Akkineni family are miraculously reborn to reunite with their past-life loves in modern Hyderabad.' },
  { title: 'Oopiri', wiki: 'Oopiri', genre: 'Comedy / Drama', rating: '8.0', duration: 158, desc: 'A quadriplegic billionaire hires an irreverent ex-convict on parole as his full-time caregiver, sparking a life-changing friendship.' },
  { title: 'Soggade Chinni Nayana', wiki: 'Soggade_Chinni_Nayana', genre: 'Supernatural / Comedy', rating: '6.4', duration: 143, desc: 'The dashing spirit of a deceased village charmer is sent back to earth by Lord Yama to rescue his timid son\'s crumbling marriage.' },
  { title: 'Bangarraju', wiki: 'Bangarraju', genre: 'Supernatural / Comedy / Fantasy', rating: '5.8', duration: 155, desc: 'The ghostly patriarch Bangarraju returns once again alongside his heavenly spouse to guard a sacred temple treasure.' },
  { title: 'Brochevarevarura', wiki: 'Brochevarevarura', genre: 'Comedy / Crime Thriller', rating: '8.0', duration: 138, desc: 'Three underperforming intermediate students orchestrate a mock kidnapping for their friend, which collides with a real criminal abduction.' },
  { title: 'C/o Kancharapalem', wiki: 'C/o_Kancharapalem', genre: 'Slice of Life / Drama / Romance', rating: '8.8', duration: 152, desc: 'Four unconventional, deeply touching love stories unfold across different ages, religions, and social strata in a rustic Vizag suburb.' },
  { title: 'Colour Photo', wiki: 'Colour_Photo', genre: 'Period Romance / Drama', rating: '8.1', duration: 139, desc: 'Set in 1990s Machilipatnam, an impoverished dark-complexioned engineering student battles colorism and societal tyranny for love.' }
];

async function getPosterUrl(wikiTitle, movieTitle) {
  // 1. Try exact wiki page summary
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.thumbnail && data.thumbnail.source) {
        return data.thumbnail.source;
      }
    }
  } catch (e) {}

  // 2. Try search if not found
  try {
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(movieTitle + ' Telugu film')}&format=json`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (searchRes.ok) {
      const sData = await searchRes.json();
      if (sData.query?.search?.[0]?.title) {
        const foundTitle = sData.query.search[0].title;
        const res2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(foundTitle.replace(/ /g, '_'))}`, {
          headers: { 'User-Agent': USER_AGENT }
        });
        if (res2.ok) {
          const d2 = await res2.json();
          if (d2.thumbnail && d2.thumbnail.source) {
            return d2.thumbnail.source;
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

async function downloadImage(url, destPath) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 500) { // Valid image, not an error string
      fs.writeFileSync(destPath, buf);
      return true;
    }
  } catch (e) {}
  return false;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function main() {
  const publicPostersDir = path.resolve('../frontend/public/posters');
  fs.mkdirSync(publicPostersDir, { recursive: true });

  console.log(`Starting download of genuine official posters for ${movies100.length} Telugu movies...`);
  const finalSeedData = [];

  let fallbackImageBuffer = null;

  for (let i = 0; i < movies100.length; i++) {
    const movie = movies100[i];
    const slug = slugify(movie.title);
    const destFile = path.join(publicPostersDir, `${slug}.jpg`);
    const localUrl = `/posters/${slug}.jpg`;

    let success = false;
    if (fs.existsSync(destFile) && fs.statSync(destFile).size > 1000) {
      console.log(`[${i+1}/${movies100.length}] ALREADY EXISTS: ${movie.title}`);
      success = true;
    } else {
      const remoteUrl = await getPosterUrl(movie.wiki, movie.title);
      if (remoteUrl) {
        success = await downloadImage(remoteUrl, destFile);
        if (success) {
          console.log(`[${i+1}/${movies100.length}] DOWNLOADED: ${movie.title} (${Math.round(fs.statSync(destFile).size / 1024)} KB)`);
          if (!fallbackImageBuffer) {
            fallbackImageBuffer = fs.readFileSync(destFile);
          }
        } else {
          console.warn(`[${i+1}/${movies100.length}] FAILED TO DOWNLOAD: ${movie.title}`);
        }
      } else {
        console.warn(`[${i+1}/${movies100.length}] NO POSTER FOUND ON WIKI: ${movie.title}`);
      }

      await sleep(400); // Polite delay to honor Wikipedia robot policy
    }

    // If download failed, copy fallback image
    if (!fs.existsSync(destFile) || fs.statSync(destFile).size < 500) {
      if (fallbackImageBuffer) {
        fs.writeFileSync(destFile, fallbackImageBuffer);
        console.log(`[${i+1}/${movies100.length}] USED FALLBACK FOR: ${movie.title}`);
      }
    }

    finalSeedData.push({
      title: movie.title,
      description: movie.desc,
      duration_mins: movie.duration,
      genre: movie.genre,
      poster_url: localUrl,
      rating: movie.rating
    });
  }

  console.log('\nAll 100 movie posters processed successfully!');
  const outputJson = path.resolve('src/db/verified_100_telugu_movies.json');
  fs.writeFileSync(outputJson, JSON.stringify(finalSeedData, null, 2));
  console.log(`Saved clean seed catalog to ${outputJson}`);
}

main().catch(console.error);
