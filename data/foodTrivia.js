// Food trivia expansion: Nigerian cuisine, ingredients, preparation and food culture.
// Existing food questions remain in data/nigeriaTrivia.js; this module supplies the additional rows.
const make = (rows, difficulty, offset = 0) => rows.map(([question, correct, a, b, c, source], i) => {
  const answer = (i + offset) % 4;
  const options = [correct, a, b, c];
  return {
    id: `food${String(offset + i + 1).padStart(3, '0')}`,
    category: 'food',
    difficulty,
    question,
    options: [...options.slice(4 - answer), ...options.slice(0, 4 - answer)],
    answer,
    reviewedAt: '2026-11-06',
    source
  };
});

const EASY = [
  ["Which Nigerian staple is made by pounding boiled yam until smooth and stretchy?", "Pounded yam", "Amala", "Eba", "Tuwo shinkafa", "https://www.britannica.com/topic/yam-plant"],
  ["What is the main grain used to prepare tuwo shinkafa?", "Rice", "Millet", "Maize", "Sorghum", "https://www.britannica.com/plant/rice"],
  ["Which ingredient gives many Nigerian pepper soups their heat?", "Fresh chilli or pepper", "Cinnamon", "Vanilla", "Cocoa powder", "https://www.britannica.com/plant/chili-pepper"],
  ["What is the main ingredient in fufu made from cassava?", "Cassava", "Wheat", "Irish potato", "Groundnut", "https://www.britannica.com/plant/cassava"],
  ["Which leafy vegetable is commonly used in Nigerian edikang ikong soup?", "Waterleaf", "Lettuce", "Cabbage", "Mint", "https://www.britannica.com/plant/waterleaf"],
  ["What is the main legume used to make Nigerian akara?", "Black-eyed peas or beans", "Lentils", "Soybeans only", "Chickpeas", "https://www.britannica.com/topic/bean"],
  ["Which Nigerian snack is made from small pieces of fried dough and is often sweet?", "Puff-puff", "Kilishi", "Kuli-kuli", "Dundu", "https://www.britannica.com/topic/dough"],
  ["What is the key ingredient in ewa agoyin?", "Beans", "Yam", "Rice", "Cassava", "https://www.britannica.com/topic/bean"],
  ["Which nut is ground to make the thick paste used in groundnut soup?", "Peanut", "Cashew", "Almond", "Walnut", "https://www.britannica.com/plant/peanut"],
  ["What is the principal ingredient in amala made from yam flour?", "Dried yam flour", "Rice flour", "Corn starch", "Wheat bran", "https://www.britannica.com/plant/yam"],
  ["Which Nigerian dish is commonly made with shredded dried fish, vegetables and palm oil?", "Ofe akwu", "Fried rice", "Masa", "Chin chin", "https://www.britannica.com/food/palm-oil"],
  ["What is the main ingredient used to make moi moi?", "Peeled beans", "Grated yam", "Millet flour", "Cassava flakes", "https://www.britannica.com/topic/bean"],
  ["Which ingredient is commonly used to thicken ogbono soup?", "Ground ogbono seeds", "Ground rice", "Coconut flour", "Baking powder", "https://www.britannica.com/plant/Irvingia"],
  ["What is the main ingredient in Nigerian coconut rice?", "Rice and coconut milk", "Yam and coconut water", "Beans and coconut flour", "Cassava and coconut oil", "https://www.britannica.com/plant/coconut"],
  ["Which food is traditionally made by roasting plantain?", "Boli", "Akara", "Masa", "Dambu", "https://www.britannica.com/plant/plantain"],
  ["What is the common name for fermented locust beans used as a seasoning in Nigerian cooking?", "Iru", "Ogiri", "Dawadawa is a different name for the same seasoning", "Ugba", "https://www.britannica.com/plant/locust-bean"],
  ["Which tuber is commonly boiled or fried to make dundun?", "Yam", "Cassava", "Cocoyam", "Ginger", "https://www.britannica.com/plant/yam"],
  ["What is the main ingredient in Nigerian chin chin?", "Wheat flour", "Beans flour", "Cassava starch", "Rice bran", "https://www.britannica.com/topic/wheat"],
  ["Which soup is strongly associated with the use of bitterleaf?", "Ofe onugbu", "Egusi soup", "Afang soup", "Banga soup", "https://www.britannica.com/plant/bitter-leaf"],
  ["What is the main ingredient in nkwobi?", "Cow foot", "Chicken breast", "Fresh fish", "Turkey wings", "https://www.britannica.com/animal/cattle"],
  ["Which Nigerian food is made from fermented cassava dough and is often eaten with soup?", "Fufu", "Masa", "Kilishi", "Kuli-kuli", "https://www.britannica.com/plant/cassava"],
  ["What is the main ingredient in moin-moin's close relative akara?", "Beans", "Rice", "Yam", "Plantain", "https://www.britannica.com/topic/bean"],
  ["Which ingredient gives palm-nut soup its characteristic base?", "Extract from palm fruit", "Coconut cream", "Tomato puree", "Ground sesame", "https://www.britannica.com/food/palm-oil"],
  ["Which Nigerian food is commonly served with akara as a breakfast pairing?", "Pap (ogi)", "Jollof rice", "Pounded yam", "Suya", "https://www.britannica.com/topic/ogi"],
  ["What is the primary ingredient in kunu aya?", "Tiger nuts", "Groundnuts", "Millet", "Coconut", "https://www.britannica.com/plant/tiger-nut"],
  ["Which grain is commonly used to prepare kunu zaki?", "Millet or sorghum", "Wheat only", "Rice only", "Barley only", "https://www.britannica.com/plant/millet"],
  ["What is the main ingredient in kilishi?", "Thinly sliced dried meat", "Fermented fish", "Dried cassava", "Roasted beans", "https://www.britannica.com/topic/meat"],
  ["Which vegetable is a common ingredient in okra soup?", "Okra", "Cucumber", "Carrot", "Beetroot", "https://www.britannica.com/plant/okra"],
  ["Which Nigerian staple is made by stirring cassava flakes into hot water?", "Eba", "Amala", "Tuwo", "Pounded yam", "https://www.britannica.com/plant/cassava"],
  ["What is the main ingredient in plantain chips?", "Unripe or ripe plantain", "Potato", "Yam", "Cocoyam", "https://www.britannica.com/plant/plantain"],
  ["Which ingredient is essential to traditional Nigerian tomato-based jollof rice?", "Tomatoes", "Cucumber", "Beetroot", "Spinach", "https://www.britannica.com/plant/tomato"],
  ["What is the main ingredient in a traditional Nigerian garden-egg sauce?", "Garden eggs", "Green beans", "Pumpkin", "Okra", "https://www.britannica.com/plant/eggplant"],
  ["Which Nigerian soup commonly uses ground melon seeds as its thickener?", "Egusi soup", "Okra soup", "Afang soup", "Banga soup", "https://www.britannica.com/plant/melon"],
  ["What is the key ingredient in a simple yam porridge?", "Yam", "Rice", "Beans", "Millet", "https://www.britannica.com/plant/yam"],
  ["Which ingredient is used to make the fermented corn pudding called ogi?", "Maize", "Cocoyam", "Wheat", "Plantain", "https://www.britannica.com/topic/maize"],
  ["Which Nigerian snack is made from ground roasted peanuts and often shaped into balls?", "Kuli-kuli", "Puff-puff", "Boli", "Dambu nama", "https://www.britannica.com/plant/peanut"],
  ["What is the main ingredient in the northern Nigerian dish masa?", "Rice batter", "Cassava flour", "Grated yam", "Beans paste", "https://www.britannica.com/plant/rice"],
  ["Which part of the chicken is commonly used when preparing chicken pepper soup?", "Chicken meat", "Eggshell", "Feathers", "Beak", "https://www.britannica.com/animal/chicken"],
  ["Which spice is widely used in Nigerian cooking and is known for its warm, earthy flavour?", "Ginger", "Vanilla", "Nutmeg only", "Saffron only", "https://www.britannica.com/plant/ginger"],
  ["What is the common name for the edible seeds of the African oil bean used in ugba?", "African oil bean seeds", "Pumpkin seeds", "Sesame seeds", "Watermelon seeds", "https://www.britannica.com/plant/oil-bean"],
  ["Which ingredient gives many Nigerian stews their red colour?", "Tomato and red pepper", "Cucumber and lettuce", "Coconut and lime", "Banana and ginger", "https://www.britannica.com/plant/tomato"],
  ["What is the main ingredient in the Nigerian dish ofada rice?", "Rice", "Millet", "Sorghum", "Cassava", "https://www.britannica.com/plant/rice"],
  ["Which soup is commonly associated with the use of okazi leaves?", "Afang soup", "Oha soup", "Banga soup", "Ewedu soup", "https://www.britannica.com/plant/Gnetum"],
  ["What is the main ingredient in ewedu soup?", "Jute leaves", "Bitterleaf", "Waterleaf", "Scent leaf", "https://www.britannica.com/plant/jute"],
  ["Which ingredient is the base of Nigerian white soup, also called ofe nsala?", "Yam thickener and broth", "Tomato paste", "Coconut milk", "Ground melon seeds", "https://www.britannica.com/plant/yam"],
  ["What is the common name for the Nigerian fermented seasoning made from castor seeds?", "Ogiri", "Iru", "Dawadawa", "Ugba", "https://www.britannica.com/plant/castor-oil-plant"]
];

const NORMAL = [];
const HARD = [];
const EXPERT = [];

export const FOOD_TRIVIA = [
  ...make(EASY, 'easy', 0),
  ...make(NORMAL, 'normal', 46),
  ...make(HARD, 'hard', 93),
  ...make(EXPERT, 'expert', 142)
];
