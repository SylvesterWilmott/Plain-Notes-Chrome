"use strict";

export function getModel(text, n) {
  const tokens = text.toLowerCase().match(/\b[\w'-]+\b/g);
  const frequencies = {}; // frequency distribution

  if (!tokens) return

  // count the occurrences of each n-gram
  for (const i in tokens) {
    if (i < tokens.length - n) {
      const gram = tokens.slice(i, parseInt(i) + n).join(" ");
      frequencies[gram] = (frequencies[gram] || 0) + 1;
    }
  }

  const model = {};
  for (const gram in frequencies) {
    const words = gram.split(" ");
    const prefix = words[0];
    const word = words[1];
    model[prefix] = model[prefix] || [];
    model[prefix].push({ word, count: frequencies[gram], prefix });
  }

  return model;
}

export function predict(prefix, model) {
  const words = model[prefix.toLowerCase()];
  if (!words) {
    return [];
  }

  // find the highest count among the words
  const maxCount = Math.max(...words.map((w) => w.count));

  // filter the words to only include those with the highest count
  const topWords = words.filter((w) => w.count === maxCount);

  // randomly choose one of the top words
  const chosenWord = topWords[Math.floor(Math.random() * topWords.length)];

  return [{ word: chosenWord.word, count: chosenWord.count, prefix: prefix }];
}
