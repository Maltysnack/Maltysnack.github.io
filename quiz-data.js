const QUIZ_DATA = {
  week: "Week 8",
  theme: "General Knowledge",
  generated: "2026-03-12",
  categories: [
    {
      name: "Politics",
      icon: "🏛️",
      questions: [
        {
          q: "Which party won the UK general election in July 2024, ending 14 years of Conservative government?",
          opts: ["Liberal Democrats", "Labour", "Reform UK", "SNP"],
          ans: 1,
          feedback: "Labour won a landslide victory in July 2024, with Keir Starmer becoming Prime Minister. The party secured over 400 seats — its biggest majority since Tony Blair's 1997 win — despite winning around 34% of the popular vote."
        },
        {
          q: "Emmanuel Macron called a snap parliamentary election in June 2024 after his party's poor performance in which vote?",
          opts: ["French regional elections", "European Parliament elections", "A French constitutional referendum", "Local municipal elections"],
          ans: 1,
          feedback: "Macron dissolved the French National Assembly after his centrist alliance was badly beaten by Marine Le Pen's National Rally in the European Parliament elections. The subsequent snap election produced a hung parliament, with no single bloc winning a majority."
        },
        {
          q: "Which country became the 32nd member of NATO in March 2024?",
          opts: ["Ukraine", "Georgia", "Finland", "Sweden"],
          ans: 3,
          feedback: "Sweden joined NATO in March 2024, completing a historic shift in Nordic security policy prompted by Russia's full-scale invasion of Ukraine. Sweden and Finland had both been neutral for decades; Finland joined NATO a year earlier in April 2023."
        },
        {
          q: "Claudia Sheinbaum was elected president of Mexico in June 2024. What was historically significant about her victory?",
          opts: ["She was the first indigenous president", "She was the first woman to hold the office", "She won with the largest margin in Mexican history", "She was the youngest president ever elected"],
          ans: 1,
          feedback: "Claudia Sheinbaum became Mexico's first female president, winning by a landslide with roughly 59% of the vote. A climate scientist and former mayor of Mexico City, she succeeded her mentor Andres Manuel Lopez Obrador."
        }
      ]
    },
    {
      name: "Sport",
      icon: "⚽",
      questions: [
        {
          q: "Which country hosted the 2024 Summer Olympics, and what was the centrepiece venue used for the opening ceremony?",
          opts: ["Spain — Camp Nou", "France — the River Seine", "Germany — Berlin Olympic Stadium", "Japan — Tokyo Dome"],
          ans: 1,
          feedback: "Paris hosted the 2024 Summer Olympics, staging a spectacular opening ceremony on the River Seine rather than inside a traditional stadium. Athletes paraded on boats through the heart of the city — a first for the Games."
        },
        {
          q: "Carlos Alcaraz won Wimbledon in both 2023 and 2024. Who did he defeat in the 2024 final?",
          opts: ["Jannik Sinner", "Daniil Medvedev", "Novak Djokovic", "Alexander Zverev"],
          ans: 2,
          feedback: "Alcaraz beat Novak Djokovic in the 2024 Wimbledon final in straight sets, denying the Serb what would have been a record-extending ninth Wimbledon title. It was the second consecutive year Alcaraz had beaten Djokovic at the All England Club."
        },
        {
          q: "At the 2024 Paris Olympics, which nation topped the overall medal table?",
          opts: ["China", "Great Britain", "United States", "Australia"],
          ans: 2,
          feedback: "The United States topped the overall medal table at Paris 2024 with 126 medals, 40 of them gold. China finished second in gold medals but third in total medals. It was another dominant performance from Team USA across swimming, athletics, and gymnastics."
        },
        {
          q: "In cricket, which team won the ICC Men's T20 World Cup in June 2024?",
          opts: ["Australia", "South Africa", "England", "India"],
          ans: 3,
          feedback: "India won the ICC Men's T20 World Cup in June 2024, defeating South Africa in a dramatic final in Barbados. It was India's first T20 World Cup title since the inaugural edition in 2007, and captain Rohit Sharma's first major ICC tournament win."
        }
      ]
    },
    {
      name: "Entertainment",
      icon: "🎬",
      questions: [
        {
          q: "Which film won Best Picture at the 2024 Academy Awards (96th Oscars)?",
          opts: ["Poor Things", "Oppenheimer", "Barbie", "The Zone of Interest"],
          ans: 1,
          feedback: "Oppenheimer swept the 96th Academy Awards, winning seven Oscars including Best Picture and Best Director for Christopher Nolan. Cillian Murphy won Best Actor for his portrayal of J. Robert Oppenheimer, his first Oscar after multiple nominations."
        },
        {
          q: "Taylor Swift's Eras Tour, which ran from 2023 to 2024, was reported to have grossed approximately how much — making it the highest-grossing concert tour of all time?",
          opts: ["$500 million", "$750 million", "$1 billion", "$2 billion"],
          ans: 2,
          feedback: "The Eras Tour crossed $1 billion in revenue — the first concert tour ever to do so — and ultimately grossed well over $2 billion by the time it concluded in December 2024. It had a significant economic impact on every city it visited."
        },
        {
          q: "Which video game, released in February 2024, became one of the fastest-selling games in history, selling 8 million copies in its first 24 hours?",
          opts: ["Dragon's Dogma 2", "Palworld", "Helldivers 2", "Black Myth: Wukong"],
          ans: 2,
          feedback: "Helldivers 2, developed by Arrowhead Game Studios, sold 8 million copies in its first 24 hours on sale, a record for Sony PlayStation Studios. It became a cultural phenomenon for its satirical take on fascist militarism and its active community events."
        },
        {
          q: "At the 2024 Grammy Awards, which artist won Album of the Year for 'Midnights'?",
          opts: ["Billie Eilish", "SZA", "Miley Cyrus", "Taylor Swift"],
          ans: 3,
          feedback: "Taylor Swift won Album of the Year for 'Midnights' at the 2024 Grammys — her fourth AOTY win, making her the sole artist in Grammy history to win the award four times. She won it previously for 'Fearless', '1989', and 'Folklore'."
        }
      ]
    },
    {
      name: "Science & Tech",
      icon: "🔬",
      questions: [
        {
          q: "In June 2024, SpaceX's Starship completed its first successful test flight to reach space and splashdown. What is distinctive about Starship compared to previous launch systems?",
          opts: ["It is fully reusable — both the booster and upper stage are designed to return and land", "It runs on liquid hydrogen rather than kerosene or methane", "It is the first rocket designed to be manufactured entirely by robots", "It is launched horizontally like a plane, not vertically"],
          ans: 0,
          feedback: "Starship is designed to be a fully and rapidly reusable launch system — both the Super Heavy booster and the Starship upper stage return and land after flight. This distinguishes it from even the Falcon 9, whose upper stage is expended on each launch. Full reusability is key to SpaceX's long-term Mars ambitions."
        },
        {
          q: "Which company released the AI model 'Claude' that became a major competitor to ChatGPT in the large language model market?",
          opts: ["Google DeepMind", "Meta AI", "Anthropic", "Mistral"],
          ans: 2,
          feedback: "Anthropic — founded in 2021 by former OpenAI researchers including Dario and Daniela Amodei — develops the Claude family of AI models. Anthropic positions its approach around 'Constitutional AI', a method for training AI systems to be more helpful, harmless, and honest."
        },
        {
          q: "The James Webb Space Telescope released its first images in 2022. What type of telescope is it — and what is its primary mission?",
          opts: ["An X-ray telescope studying black holes and neutron stars", "An infrared telescope studying the early universe and exoplanet atmospheres", "A radio telescope mapping cosmic microwave background radiation", "An ultraviolet telescope studying stellar formation in nearby galaxies"],
          ans: 1,
          feedback: "Webb is an infrared telescope, positioned 1.5 million km from Earth at the L2 Lagrange point. Infrared light lets it peer through dust clouds and observe the most distant galaxies in the universe — some dating to just a few hundred million years after the Big Bang. It can also analyse exoplanet atmospheres."
        },
        {
          q: "In 2024, scientists announced that the global average temperature had exceeded a critical climate threshold for the first time. What was that threshold?",
          opts: ["1.0°C above pre-industrial levels", "1.5°C above pre-industrial levels", "2.0°C above pre-industrial levels", "2.5°C above pre-industrial levels"],
          ans: 1,
          feedback: "2024 was confirmed as the first year in recorded history where the global average temperature exceeded 1.5°C above pre-industrial levels — the threshold that world governments agreed in the Paris Agreement to try to avoid. Scientists noted this was a single-year breach rather than a permanent shift, but it underscored the urgency of the climate situation."
        }
      ]
    },
    {
      name: "General Knowledge",
      icon: "🌍",
      questions: [
        {
          q: "The Strait of Malacca, one of the world's most important shipping lanes, connects which two bodies of water?",
          opts: ["The Indian Ocean and the South China Sea", "The Persian Gulf and the Arabian Sea", "The Red Sea and the Mediterranean", "The Bay of Bengal and the Coral Sea"],
          ans: 0,
          feedback: "The Strait of Malacca connects the Indian Ocean with the South China Sea, running between the Malay Peninsula and the Indonesian island of Sumatra. It is one of the world's busiest shipping lanes, carrying around a quarter of global trade — including enormous volumes of oil from the Middle East to East Asia."
        },
        {
          q: "Which element has the chemical symbol 'W', and why — given that the element's English name doesn't begin with W?",
          opts: ["Wolfram, because it was named after the mineral wolframite before tungsten became the English standard", "Wulfenite, a variant spelling used in 18th-century German chemistry", "Sodium, where W stands for 'Wasser' (water) in early notation", "Manganese, after the town of Wolfsberg where it was first mined"],
          ans: 0,
          feedback: "Tungsten's symbol W comes from 'Wolfram', the name still used in most European languages. The element was first identified in the mineral wolframite in the 18th century, and the Germanic name stuck in the symbol even after 'tungsten' (from Swedish, meaning 'heavy stone') became the English standard."
        },
        {
          q: "In Japanese cuisine, what is 'umami' — often described as the fifth basic taste?",
          opts: ["A smoky bitterness derived from charcoal-grilled foods", "A savoury, meaty depth often associated with glutamate-rich foods like soy sauce, mushrooms, and aged cheese", "A sharp, pungent heat from wasabi and similar compounds", "A rich fatty taste associated with oils and marbled meats"],
          ans: 1,
          feedback: "Umami was identified by Japanese chemist Kikunae Ikeda in 1908 and is often described as a savoury, brothy depth. It is primarily triggered by glutamate — found naturally in foods like soy sauce, miso, parmesan, tomatoes, anchovies, and shiitake mushrooms. The word umami roughly translates as 'pleasant savoury taste'."
        },
        {
          q: "The Trans-Siberian Railway, the longest railway line in the world, runs between Moscow and which city on the Pacific coast of Russia?",
          opts: ["Yakutsk", "Magadan", "Vladivostok", "Petropavlovsk-Kamchatsky"],
          ans: 2,
          feedback: "The Trans-Siberian Railway runs approximately 9,289 km between Moscow and Vladivostok, the largest city on Russia's Pacific coast. Completed in 1916, it crosses eight time zones and takes around seven days to traverse by the main route. Vladivostok's name roughly translates as 'Ruler of the East'."
        }
      ]
    }
  ]
};
