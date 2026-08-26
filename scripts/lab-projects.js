(function () {
  "use strict";

  window.GISLAB_LAB_PROJECTS = [
    {
      id: "vattenforbrukning-vattern",
      title: "Vattenförbrukning i Vättern",
      category: "Vatten och resurser",
      status: "Prototyp",
      summary: "Utforska Vätterns vattenvolym som en 3D-brödlimpa och jämför vardaglig vattenförbrukning med hela sjön.",
      tags: ["Vättern", "Vattenförbrukning", "3D"],
      url: "/lab/vattenforbrukning/"
    },
    {
      id: "salenfjallen-3d",
      title: "S\u00e4lenfj\u00e4llen i 3D",
      category: "Terr\u00e4ng och turism",
      status: "Prototyp",
      summary: "Utforska S\u00e4lenfj\u00e4llen i en interaktiv 3D-modell med h\u00f6jdkurvor, skidanl\u00e4ggningar och flygplatsen.",
      tags: ["S\u00e4lenfj\u00e4llen", "Terr\u00e4ng", "3D"],
      url: "/lab/salenfjallen-3d/"
    },
    {
      id: "kollektivtrafik-dalarna",
      title: "Kollektivtrafik i Dalarna",
      category: "Mobilitet och tillgänglighet",
      status: "Prototyp",
      summary: "Utforska Dalatrafiks planerade trafik, linjer och hållplatser för den aktuella referensveckan.",
      tags: ["Dalatrafik", "GTFS", "Kollektivtrafik"],
      url: "https://kollektivtrafik-dalarna.streamlit.app/"
    },
    {
      id: "viltpassager-ecodukter",
      title: "Viltpassager och ekodukter",
      category: "Ekologiska samband",
      status: "Utforskas",
      summary: "Kartor och analyser kring ekologiska samband, barriärer och möjliga passager för djur.",
      tags: ["Natur", "Infrastruktur", "Konnektivitet"],
      questions: [
        "Var skär större vägar genom viktiga rörelsestråk?",
        "Vilka platser kan vara lämpliga för passager eller ekodukter?",
        "Hur kan befintliga naturvärden vägas ihop med barriäreffekter?"
      ],
      emptyMessage: "Det här projektet är ännu bara en idé i Labbet. Här kan en analys av ekologiska samband, barriärer och möjliga viltpassager läggas till senare."
    },
    {
      id: "barnperspektiv-planering",
      title: "Barnperspektiv i planering",
      category: "Social planering",
      status: "Idé",
      summary: "Utforskning av hur barns bästa kan synliggöras i fysisk planering, tillgänglighet och livsmiljöer.",
      tags: ["Barnkonventionen", "Tillgänglighet", "Livsmiljö"],
      questions: [
        "Hur ser barns närhet till skola, grönska och trygga stråk ut?",
        "Var finns barriärer som minskar barns rörelsefrihet?",
        "Hur kan barnkonventionen översättas till kartbara planeringsfrågor?"
      ],
      emptyMessage: "Det här projektet är ännu bara en idé i Labbet. Här kan kartor, indikatorer eller en enkel app för barnperspektiv i planering läggas till senare."
    },
    {
      id: "havsniva-klimatanpassning",
      title: "Havsnivå och klimatanpassning",
      category: "Klimat",
      status: "Prototyp",
      summary: "En interaktiv 3D-modell av stigande havsnivåer i Skåne, med terrängförstoring, dagens strandlinje och scenarier från 0 till +65 meter.",
      tags: ["Havsnivå", "Klimatanpassning", "Skåne", "3D"],
      appUrl: "/lab/havsniva-klimatanpassning/",
      description: "Modellen visar markytor som kan nås av havet vid vald nivå. Höjddata kommer från Lantmäteriets markhöjdmodell och är webboptimerad för regional översikt.",
      note: "Ett pedagogiskt scenario: det inkluderar inte stormflod, vågor, erosion, vallar eller avvattning."
    },
    {
      id: "markreformer-agostruktur",
      title: "Markreformer och ägostruktur",
      category: "Mark och ägande",
      status: "Idé",
      summary: "Idéer och analyser kring markanvändning, fastighetsstruktur och framtida reformer.",
      subtopics: ["Omvänt skifte"],
      tags: ["Fastigheter", "Markanvändning", "Reformidéer"],
      questions: [
        "Hur påverkar dagens ägostruktur möjligheten att planera långsiktigt?",
        "Var kan samlad eller omfördelad mark skapa större landskapsnytta?",
        "Hur skulle ett omvänt skifte kunna visualiseras som planeringsidé?"
      ],
      emptyMessage: "Det här projektet är ännu bara en idé i Labbet. Omvänt skifte ligger här som ett underämne och kan senare bli en egen analys, karta eller prototyp."
    }
  ];
})();
