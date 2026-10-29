# Pawprint Park: species catalogue

The full list of animals in the finished game. **✅ v1** marks the 30 species built first. Every other species is
still listed in the Zoopedia and the animal market as a locked silhouette marked "Coming soon" (PRD §8).

This file is the planning list. The game data (`src/data/species/`) is generated from it and adds the numbers:
lifespan, gestation, maturity, portions per day, space, group size, temperature range, price and compatibility.

**Columns**

- **Plan**: the code-built body plan the model is made from (see below). New species reuse a plan with their own
  proportions, colours and patterns.
- **Tier**: unlock band from 1 (start) to 8 (late game). How tiers map to keeper levels lives in the economy file.
- **Diet**: herb(ivore), carn(ivore), omni(vore), insect(ivore), fish, nectar, filter.
- **IUCN**: Red List status, written from memory. **Check every status before writing Zoopedia text.** Dom =
  domesticated, NE = not evaluated, DD = data deficient.

**Body plans**: `hoof` (hoofed quadruped, incl. long-neck variant), `cat`, `dog`, `bear`, `small` (small mammal),
`pachy` (elephant, rhino, hippo, tapir), `primate`, `pinniped`, `bird-walk`, `bird-perch`, `penguin`, `lizard`,
`croc`, `snake`, `turtle`, `amphibian`, `fish`, `shark`, `ray`, `cephalopod`, `jelly`, `bat`, `bug`.
v1 needs 12 of them: `hoof`, `cat`, `dog`, `bear`, `small`, `pachy`, `pinniped`, `bird-walk`, `bird-perch`,
`penguin`, `lizard`, `turtle`.

**Biomes / houses (16)**: v1 ships 8 of them: Farmyard, African Savanna, Asian Jungle, Polar & Tundra, Coast & Sea,
Wetland, Reptile & Amphibian House and Aviary.

Total: **233 species**.

---

## Farmyard (15)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 1 | Domestic sheep | *Ovis aries* | hoof | 1 | herb | Dom | ✅ v1 |
| 2 | Domestic goat | *Capra hircus* | hoof | 1 | herb | Dom | ✅ v1 |
| 3 | Domestic pig | *Sus domesticus* | hoof | 1 | omni | Dom | ✅ v1 |
| 4 | Domestic rabbit | *Oryctolagus cuniculus* | small | 1 | herb | Dom | ✅ v1 |
| 5 | Chicken | *Gallus gallus domesticus* | bird-walk | 1 | omni | Dom | ✅ v1 |
| 6 | Donkey | *Equus asinus* | hoof | 1 | herb | Dom | ✅ v1 |
| 7 | Alpaca | *Vicugna pacos* | hoof | 2 | herb | Dom | ✅ v1 |
| 8 | Domestic duck | *Anas platyrhynchos domesticus* | bird-walk | 1 | omni | Dom | |
| 9 | Domestic goose | *Anser anser domesticus* | bird-walk | 1 | herb | Dom | |
| 10 | Guinea pig | *Cavia porcellus* | small | 1 | herb | Dom | |
| 11 | Domestic cow | *Bos taurus* | hoof | 2 | herb | Dom | |
| 12 | Shetland pony | *Equus caballus* | hoof | 2 | herb | Dom | |
| 13 | Llama | *Lama glama* | hoof | 2 | herb | Dom | |
| 14 | Domestic turkey | *Meleagris gallopavo* | bird-walk | 2 | omni | Dom | |
| 15 | Highland cattle | *Bos taurus* (Highland) | hoof | 3 | herb | Dom | |

## Temperate Forest (16)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 16 | European hedgehog | *Erinaceus europaeus* | small | 1 | insect | NT | |
| 17 | Red fox | *Vulpes vulpes* | dog | 2 | carn | LC | |
| 18 | European badger | *Meles meles* | small | 2 | omni | LC | |
| 19 | Red deer | *Cervus elaphus* | hoof | 2 | herb | LC | |
| 20 | Wild boar | *Sus scrofa* | hoof | 2 | omni | LC | |
| 21 | Eurasian red squirrel | *Sciurus vulgaris* | small | 2 | herb | LC | |
| 22 | Raccoon | *Procyon lotor* | small | 2 | omni | LC | |
| 23 | Eurasian beaver | *Castor fiber* | small | 3 | herb | LC | |
| 24 | Eurasian eagle-owl | *Bubo bubo* | bird-perch | 3 | carn | LC | |
| 25 | Eurasian lynx | *Lynx lynx* | cat | 4 | carn | LC | |
| 26 | Grey wolf | *Canis lupus* | dog | 4 | carn | LC | |
| 27 | American black bear | *Ursus americanus* | bear | 4 | omni | LC | |
| 28 | Moose | *Alces alces* | hoof | 4 | herb | LC | |
| 29 | Brown bear | *Ursus arctos* | bear | 5 | omni | LC | |
| 30 | European bison | *Bison bonasus* | hoof | 5 | herb | NT | |
| 31 | Wolverine | *Gulo gulo* | small | 5 | carn | LC | |

## African Savanna (20)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 32 | Meerkat | *Suricata suricatta* | small | 2 | insect | LC | ✅ v1 |
| 33 | Plains zebra | *Equus quagga* | hoof | 2 | herb | NT | ✅ v1 |
| 34 | Common ostrich | *Struthio camelus* | bird-walk | 2 | omni | LC | ✅ v1 |
| 35 | Common warthog | *Phacochoerus africanus* | hoof | 2 | omni | LC | ✅ v1 |
| 36 | Reticulated giraffe | *Giraffa reticulata* | hoof | 3 | herb | EN | ✅ v1 |
| 37 | Lion | *Panthera leo* | cat | 4 | carn | VU | ✅ v1 |
| 38 | Blue wildebeest | *Connochaetes taurinus* | hoof | 3 | herb | LC | |
| 39 | Thomson's gazelle | *Eudorcas thomsonii* | hoof | 3 | herb | NT | |
| 40 | Greater kudu | *Tragelaphus strepsiceros* | hoof | 3 | herb | LC | |
| 41 | Grey crowned crane | *Balearica regulorum* | bird-walk | 3 | omni | EN | |
| 42 | Spotted hyena | *Crocuta crocuta* | dog | 4 | carn | LC | |
| 43 | Cape buffalo | *Syncerus caffer* | hoof | 4 | herb | NT | |
| 44 | Southern ground hornbill | *Bucorvus leadbeateri* | bird-walk | 4 | carn | VU | |
| 45 | Cheetah | *Acinonyx jubatus* | cat | 5 | carn | VU | |
| 46 | Leopard | *Panthera pardus* | cat | 5 | carn | VU | |
| 47 | African wild dog | *Lycaon pictus* | dog | 5 | carn | EN | |
| 48 | Common hippopotamus | *Hippopotamus amphibius* | pachy | 5 | herb | VU | |
| 49 | African bush elephant | *Loxodonta africana* | pachy | 6 | herb | EN | |
| 50 | Southern white rhinoceros | *Ceratotherium simum* | pachy | 6 | herb | NT | |
| 51 | Black rhinoceros | *Diceros bicornis* | pachy | 7 | herb | CR | |

## Desert & Dry Plains (10)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 52 | Rock hyrax | *Procavia capensis* | small | 2 | herb | LC | |
| 53 | Black-tailed prairie dog | *Cynomys ludovicianus* | small | 2 | herb | LC | |
| 54 | Fennec fox | *Vulpes zerda* | dog | 3 | omni | LC | |
| 55 | Dromedary camel | *Camelus dromedarius* | hoof | 3 | herb | Dom | |
| 56 | Bactrian camel | *Camelus bactrianus* | hoof | 3 | herb | Dom | |
| 57 | Dorcas gazelle | *Gazella dorcas* | hoof | 3 | herb | VU | |
| 58 | Barbary sheep | *Ammotragus lervia* | hoof | 3 | herb | VU | |
| 59 | Sand cat | *Felis margarita* | cat | 4 | carn | LC | |
| 60 | Arabian oryx | *Oryx leucoryx* | hoof | 5 | herb | VU | |
| 61 | Addax | *Addax nasomaculatus* | hoof | 6 | herb | CR | |

## Asian Jungle (17)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 62 | Red panda | *Ailurus fulgens* | small | 3 | herb | EN | ✅ v1 |
| 63 | Asian small-clawed otter | *Aonyx cinereus* | small | 3 | fish | VU | ✅ v1 |
| 64 | Malayan tapir | *Tapirus indicus* | pachy | 4 | herb | EN | ✅ v1 |
| 65 | Bengal tiger | *Panthera tigris tigris* | cat | 5 | carn | EN | ✅ v1 |
| 66 | Asian elephant | *Elephas maximus* | pachy | 6 | herb | EN | ✅ v1 |
| 67 | Giant panda | *Ailuropoda melanoleuca* | bear | 7 | herb | VU | ✅ v1 |
| 68 | Indian peafowl | *Pavo cristatus* | bird-walk | 2 | omni | LC | |
| 69 | Reeves's muntjac | *Muntiacus reevesi* | hoof | 2 | herb | LC | |
| 70 | Binturong | *Arctictis binturong* | small | 4 | omni | VU | |
| 71 | Siamang | *Symphalangus syndactylus* | primate | 4 | herb | EN | |
| 72 | Lar gibbon | *Hylobates lar* | primate | 4 | herb | EN | |
| 73 | Sun bear | *Helarctos malayanus* | bear | 4 | omni | VU | |
| 74 | Banteng | *Bos javanicus* | hoof | 4 | herb | EN | |
| 75 | Clouded leopard | *Neofelis nebulosa* | cat | 5 | carn | VU | |
| 76 | Indian rhinoceros | *Rhinoceros unicornis* | pachy | 6 | herb | VU | |
| 77 | Sumatran tiger | *Panthera tigris sondaica* | cat | 7 | carn | CR | |
| 78 | Sumatran orangutan | *Pongo abelii* | primate | 7 | herb | CR | |

## Tropical Rainforest: Americas, Africa, Madagascar (20)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 79 | Capybara | *Hydrochoerus hydrochaeris* | small | 2 | herb | LC | |
| 80 | South American coati | *Nasua nasua* | small | 2 | omni | LC | |
| 81 | Ring-tailed lemur | *Lemur catta* | primate | 3 | herb | EN | |
| 82 | Common squirrel monkey | *Saimiri sciureus* | primate | 3 | omni | LC | |
| 83 | Red river hog | *Potamochoerus porcus* | hoof | 3 | omni | LC | |
| 84 | Black-handed spider monkey | *Ateles geoffroyi* | primate | 4 | herb | EN | |
| 85 | Ocelot | *Leopardus pardalis* | cat | 4 | carn | LC | |
| 86 | South American tapir | *Tapirus terrestris* | pachy | 4 | herb | VU | |
| 87 | Linnaeus's two-toed sloth | *Choloepus didactylus* | small | 4 | herb | LC | |
| 88 | Golden lion tamarin | *Leontopithecus rosalia* | primate | 5 | omni | EN | |
| 89 | Red ruffed lemur | *Varecia rubra* | primate | 5 | herb | CR | |
| 90 | Jaguar | *Panthera onca* | cat | 5 | carn | NT | |
| 91 | Giant anteater | *Myrmecophaga tridactyla* | small | 5 | insect | VU | |
| 92 | Okapi | *Okapia johnstoni* | hoof | 6 | herb | EN | |
| 93 | Mandrill | *Mandrillus sphinx* | primate | 6 | omni | VU | |
| 94 | Fossa | *Cryptoprocta ferox* | cat | 6 | carn | VU | |
| 95 | Bongo | *Tragelaphus eurycerus* | hoof | 6 | herb | NT | |
| 96 | Chimpanzee | *Pan troglodytes* | primate | 7 | omni | EN | |
| 97 | Western lowland gorilla | *Gorilla gorilla gorilla* | primate | 8 | herb | CR | |
| 98 | Bonobo | *Pan paniscus* | primate | 8 | omni | EN | |

## Wetland & Rivers (13)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 99 | Chilean flamingo | *Phoenicopterus chilensis* | bird-walk | 2 | filter | NT | ✅ v1 |
| 100 | Black swan | *Cygnus atratus* | bird-walk | 2 | herb | LC | |
| 101 | Greater flamingo | *Phoenicopterus roseus* | bird-walk | 3 | filter | LC | |
| 102 | Great white pelican | *Pelecanus onocrotalus* | bird-walk | 3 | fish | LC | |
| 103 | Scarlet ibis | *Eudocimus ruber* | bird-walk | 3 | omni | LC | |
| 104 | Eurasian otter | *Lutra lutra* | small | 3 | fish | NT | |
| 105 | American alligator | *Alligator mississippiensis* | croc | 4 | carn | LC | |
| 106 | Sitatunga | *Tragelaphus spekii* | hoof | 4 | herb | LC | |
| 107 | Nile crocodile | *Crocodylus niloticus* | croc | 5 | carn | LC | |
| 108 | Pygmy hippopotamus | *Choeropsis liberiensis* | pachy | 5 | herb | EN | |
| 109 | Giant otter | *Pteronura brasiliensis* | small | 6 | fish | EN | |
| 110 | Shoebill | *Balaeniceps rex* | bird-walk | 6 | fish | VU | |
| 111 | Gharial | *Gavialis gangeticus* | croc | 7 | fish | CR | |

## Polar & Tundra (12)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 112 | Arctic fox | *Vulpes lagopus* | dog | 2 | carn | LC | ✅ v1 |
| 113 | Reindeer | *Rangifer tarandus* | hoof | 2 | herb | VU | ✅ v1 |
| 114 | Gentoo penguin | *Pygoscelis papua* | penguin | 3 | fish | LC | ✅ v1 |
| 115 | Polar bear | *Ursus maritimus* | bear | 6 | carn | VU | ✅ v1 |
| 116 | Arctic hare | *Lepus arcticus* | small | 2 | herb | LC | |
| 117 | Snowy owl | *Bubo scandiacus* | bird-perch | 3 | carn | VU | |
| 118 | King penguin | *Aptenodytes patagonicus* | penguin | 4 | fish | LC | |
| 119 | Southern rockhopper penguin | *Eudyptes chrysocome* | penguin | 4 | fish | VU | |
| 120 | Muskox | *Ovibos moschatus* | hoof | 4 | herb | LC | |
| 121 | Arctic wolf | *Canis lupus arctos* | dog | 5 | carn | LC | |
| 122 | Walrus | *Odobenus rosmarus* | pinniped | 6 | carn | VU | |
| 123 | Emperor penguin | *Aptenodytes forsteri* | penguin | 7 | fish | NT | |

## Mountain (11)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 124 | Alpine marmot | *Marmota marmota* | small | 2 | herb | LC | |
| 125 | Alpine ibex | *Capra ibex* | hoof | 3 | herb | LC | |
| 126 | Himalayan tahr | *Hemitragus jemlahicus* | hoof | 3 | herb | NT | |
| 127 | Vicuña | *Vicugna vicugna* | hoof | 3 | herb | LC | |
| 128 | Golden eagle | *Aquila chrysaetos* | bird-perch | 4 | carn | LC | |
| 129 | Mountain goat | *Oreamnos americanus* | hoof | 4 | herb | LC | |
| 130 | Japanese macaque | *Macaca fuscata* | primate | 4 | omni | LC | |
| 131 | Takin | *Budorcas taxicolor* | hoof | 5 | herb | VU | |
| 132 | Andean bear | *Tremarctos ornatus* | bear | 5 | omni | VU | |
| 133 | Snow leopard | *Panthera uncia* | cat | 6 | carn | VU | |
| 134 | Andean condor | *Vultur gryphus* | bird-perch | 6 | carn | VU | |

## Australian Outback (12)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 135 | Red-necked wallaby | *Notamacropus rufogriseus* | small | 2 | herb | LC | |
| 136 | Emu | *Dromaius novaehollandiae* | bird-walk | 2 | omni | LC | |
| 137 | Red kangaroo | *Osphranter rufus* | small | 3 | herb | LC | |
| 138 | Laughing kookaburra | *Dacelo novaeguineae* | bird-perch | 3 | carn | LC | |
| 139 | Common wombat | *Vombatus ursinus* | small | 4 | herb | LC | |
| 140 | Short-beaked echidna | *Tachyglossus aculeatus* | small | 4 | insect | LC | |
| 141 | Dingo | *Canis dingo* | dog | 4 | carn | VU | |
| 142 | Quokka | *Setonix brachyurus* | small | 5 | herb | VU | |
| 143 | Koala | *Phascolarctos cinereus* | small | 6 | herb | VU | |
| 144 | Tasmanian devil | *Sarcophilus harrisii* | small | 6 | carn | EN | |
| 145 | Southern cassowary | *Casuarius casuarius* | bird-walk | 6 | omni | LC | |
| 146 | Platypus | *Ornithorhynchus anatinus* | small | 7 | carn | NT | |

## Coast & Sea: outdoor pools (12)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 147 | California sea lion | *Zalophus californianus* | pinniped | 3 | fish | LC | ✅ v1 |
| 148 | Harbour seal | *Phoca vitulina* | pinniped | 3 | fish | LC | ✅ v1 |
| 149 | Humboldt penguin | *Spheniscus humboldti* | penguin | 3 | fish | VU | |
| 150 | Grey seal | *Halichoerus grypus* | pinniped | 3 | fish | LC | |
| 151 | Brown pelican | *Pelecanus occidentalis* | bird-walk | 3 | fish | LC | |
| 152 | Inca tern | *Larosterna inca* | bird-perch | 3 | fish | NT | |
| 153 | African penguin | *Spheniscus demersus* | penguin | 4 | fish | CR | |
| 154 | Atlantic puffin | *Fratercula arctica* | bird-walk | 4 | fish | VU | |
| 155 | Cape fur seal | *Arctocephalus pusillus* | pinniped | 4 | fish | LC | |
| 156 | Sea otter | *Enhydra lutris* | small | 5 | carn | EN | |
| 157 | Steller sea lion | *Eumetopias jubatus* | pinniped | 6 | fish | NT | |
| 158 | West Indian manatee | *Trichechus manatus* | pinniped | 7 | herb | VU | |

## Aquarium: building (16)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 159 | Clown anemonefish | *Amphiprion ocellaris* | fish | 2 | omni | LC | |
| 160 | Blue tang | *Paracanthurus hepatus* | fish | 2 | herb | LC | |
| 161 | Spotted garden eel | *Heteroconger hassi* | fish | 2 | carn | LC | |
| 162 | Moon jellyfish | *Aurelia aurita* | jelly | 3 | filter | NE | |
| 163 | Lined seahorse | *Hippocampus erectus* | fish | 3 | carn | VU | |
| 164 | Red lionfish | *Pterois volitans* | fish | 3 | carn | LC | |
| 165 | Red-bellied piranha | *Pygocentrus nattereri* | fish | 3 | carn | NE | |
| 166 | Green moray | *Gymnothorax funebris* | fish | 4 | carn | LC | |
| 167 | Cownose ray | *Rhinoptera bonasus* | ray | 4 | carn | VU | |
| 168 | Common octopus | *Octopus vulgaris* | cephalopod | 5 | carn | LC | |
| 169 | Blacktip reef shark | *Carcharhinus melanopterus* | shark | 5 | carn | VU | |
| 170 | Arapaima | *Arapaima gigas* | fish | 5 | carn | DD | |
| 171 | Giant Pacific octopus | *Enteroctopus dofleini* | cephalopod | 6 | carn | NE | |
| 172 | Zebra shark | *Stegostoma tigrinum* | shark | 6 | carn | EN | |
| 173 | Green sea turtle | *Chelonia mydas* | turtle | 6 | herb | EN | |
| 174 | Scalloped hammerhead | *Sphyrna lewini* | shark | 8 | carn | CR | |

## Reptile & Amphibian House: building (19)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 175 | Leopard tortoise | *Stigmochelys pardalis* | turtle | 2 | herb | LC | ✅ v1 |
| 176 | Green iguana | *Iguana iguana* | lizard | 2 | herb | LC | ✅ v1 |
| 177 | Komodo dragon | *Varanus komodoensis* | lizard | 6 | carn | EN | ✅ v1 |
| 178 | Bearded dragon | *Pogona vitticeps* | lizard | 2 | omni | LC | |
| 179 | Leopard gecko | *Eublepharis macularius* | lizard | 2 | insect | LC | |
| 180 | Royal python | *Python regius* | snake | 3 | carn | NT | |
| 181 | Panther chameleon | *Furcifer pardalis* | lizard | 3 | insect | LC | |
| 182 | Strawberry poison dart frog | *Oophaga pumilio* | amphibian | 3 | insect | LC | |
| 183 | Red-eyed tree frog | *Agalychnis callidryas* | amphibian | 3 | insect | LC | |
| 184 | Aldabra giant tortoise | *Aldabrachelys gigantea* | turtle | 4 | herb | VU | |
| 185 | Green tree python | *Morelia viridis* | snake | 4 | carn | LC | |
| 186 | Emerald tree boa | *Corallus caninus* | snake | 4 | carn | LC | |
| 187 | Gila monster | *Heloderma suspectum* | lizard | 4 | carn | NT | |
| 188 | Axolotl | *Ambystoma mexicanum* | amphibian | 4 | carn | CR | |
| 189 | Reticulated python | *Malayopython reticulatus* | snake | 5 | carn | LC | |
| 190 | Thorny devil | *Moloch horridus* | lizard | 5 | insect | LC | |
| 191 | Mata mata | *Chelus fimbriata* | turtle | 5 | carn | LC | |
| 192 | King cobra | *Ophiophagus hannah* | snake | 6 | carn | VU | |
| 193 | Chinese giant salamander | *Andrias davidianus* | amphibian | 6 | carn | CR | |

## Aviary: walk-through (16)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 194 | Scarlet macaw | *Ara macao* | bird-perch | 3 | herb | LC | ✅ v1 |
| 195 | Budgerigar | *Melopsittacus undulatus* | bird-perch | 1 | herb | LC | |
| 196 | Rainbow lorikeet | *Trichoglossus moluccanus* | bird-perch | 2 | nectar | LC | |
| 197 | Golden pheasant | *Chrysolophus pictus* | bird-walk | 2 | omni | LC | |
| 198 | Mandarin duck | *Aix galericulata* | bird-walk | 2 | omni | LC | |
| 199 | Superb starling | *Lamprotornis superbus* | bird-perch | 2 | omni | LC | |
| 200 | Sulphur-crested cockatoo | *Cacatua galerita* | bird-perch | 3 | herb | LC | |
| 201 | Keel-billed toucan | *Ramphastos sulfuratus* | bird-perch | 3 | omni | LC | |
| 202 | Victoria crowned pigeon | *Goura victoria* | bird-walk | 4 | herb | NT | |
| 203 | Hyacinth macaw | *Anodorhynchus hyacinthinus* | bird-perch | 5 | herb | VU | |
| 204 | Great hornbill | *Buceros bicornis* | bird-perch | 5 | omni | VU | |
| 205 | Kea | *Nestor notabilis* | bird-perch | 5 | omni | EN | |
| 206 | Bald eagle | *Haliaeetus leucocephalus* | bird-perch | 5 | carn | LC | |
| 207 | Resplendent quetzal | *Pharomachrus mocinno* | bird-perch | 6 | herb | NT | |
| 208 | Harpy eagle | *Harpia harpyja* | bird-perch | 7 | carn | VU | |
| 209 | Philippine eagle | *Pithecophaga jefferyi* | bird-perch | 8 | carn | CR | |

## Nocturnal House: building, day/night reversed (13)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 210 | Barn owl | *Tyto alba* | bird-perch | 2 | carn | LC | |
| 211 | Egyptian fruit bat | *Rousettus aegyptiacus* | bat | 3 | herb | LC | |
| 212 | Senegal bushbaby | *Galago senegalensis* | primate | 3 | omni | LC | |
| 213 | Sugar glider | *Petaurus breviceps* | small | 3 | omni | LC | |
| 214 | Naked mole-rat | *Heterocephalus glaber* | small | 3 | herb | LC | |
| 215 | Large flying fox | *Pteropus vampyrus* | bat | 4 | herb | EN | |
| 216 | Aardvark | *Orycteropus afer* | small | 5 | insect | LC | |
| 217 | Bengal slow loris | *Nycticebus bengalensis* | primate | 5 | omni | EN | |
| 218 | Greater bilby | *Macrotis lagotis* | small | 5 | omni | VU | |
| 219 | Philippine tarsier | *Carlito syrichta* | primate | 6 | insect | NT | |
| 220 | Aye-aye | *Daubentonia madagascariensis* | primate | 7 | omni | EN | |
| 221 | North Island brown kiwi | *Apteryx mantelli* | bird-walk | 7 | insect | VU | |
| 222 | Sunda pangolin | *Manis javanica* | small | 8 | insect | CR | |

## Bug House: building (11)

| # | Species | Scientific name | Plan | Tier | Diet | IUCN | |
|---|---|---|---|---|---|---|---|
| 223 | Madagascar hissing cockroach | *Gromphadorhina portentosa* | bug | 2 | herb | NE | |
| 224 | Blue morpho butterfly | *Morpho peleides* | bug | 2 | nectar | NE | |
| 225 | Monarch butterfly | *Danaus plexippus* | bug | 2 | nectar | LC | |
| 226 | Western honey bee (colony) | *Apis mellifera* | bug | 2 | nectar | DD | |
| 227 | Leafcutter ant (colony) | *Atta cephalotes* | bug | 3 | herb | NE | |
| 228 | Atlas moth | *Attacus atlas* | bug | 3 | nectar | NE | |
| 229 | Giant prickly stick insect | *Extatosoma tiaratum* | bug | 3 | herb | NE | |
| 230 | Goliath birdeater | *Theraphosa blondi* | bug | 4 | carn | NE | |
| 231 | Emperor scorpion | *Pandinus imperator* | bug | 4 | carn | NE | |
| 232 | Orchid mantis | *Hymenopus coronatus* | bug | 4 | carn | NE | |
| 233 | Hercules beetle | *Dynastes hercules* | bug | 4 | herb | NE | |
