/* ============================================================
   Joker's Patience — карточный пасьянс-головоломка
   Чистый vanilla JS, без внешних зависимостей.
   Комментарии на русском.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   1. КОНСТАНТЫ И КОНФИГУРАЦИЯ
   ------------------------------------------------------------ */

const TOTAL_ROUNDS = 6;           // сколько раундов нужно пройти
const HAND_SIZE = 8;              // размер руки
const MAX_PLAY = 5;               // максимум карт в комбинации
const MAX_DISCARDS = 3;           // базовое число сбросов за раунд
const BASE_HANDS = 4;             // базовое число раздач за раунд

// Базовые значения покерных комбинаций: [chips, mult]
const BASE_VALUES = {
  'High Card':      [5, 1],
  'Pair':           [10, 2],
  'Two Pair':       [20, 2],
  'Three of a Kind':[30, 3],
  'Straight':       [30, 4],
  'Flush':          [35, 4],
  'Full House':     [40, 4],
  'Four of a Kind': [60, 7],
  'Straight Flush': [100, 8],
  'Royal Flush':    [150, 10]
};

// Русские названия комбинаций
const COMBO_RU = {
  'High Card': 'Старшая карта',
  'Pair': 'Пара',
  'Two Pair': 'Две пары',
  'Three of a Kind': 'Сет',
  'Straight': 'Стрит',
  'Flush': 'Флеш',
  'Full House': 'Фулл-хаус',
  'Four of a Kind': 'Каре',
  'Straight Flush': 'Стрит-флеш',
  'Royal Flush': 'Роял-флеш'
};

// Описания джокеров (библиотека)
const JOKER_LIBRARY = [
  {
    id: 'sev',
    name: 'Семёрка удачи',
    icon: '7',
    desc: '+30 chips за каждую сыгранную семёрку',
    color: '#ffd76a',
    trigger: null // вычисляется в applyJokers
  },
  {
    id: 'hearts',
    name: 'Черви',
    icon: '♥',
    desc: '×2 mult, если в комбинации есть черви',
    color: '#ff6a8a',
    trigger: null
  },
  {
    id: 'memory',
    name: 'Память сброса',
    icon: '◈',
    desc: 'Каждая сброшенная карта даёт +1 к множителю следующей раздачи',
    color: '#b06aff',
    trigger: null
  },
  {
    id: 'even',
    name: 'Чётный баланс',
    icon: '⊕',
    desc: '+25 chips за каждую чётную карту в комбинации',
    color: '#6affb0',
    trigger: null
  },
  {
    id: 'face',
    name: 'Королевский двор',
    icon: '♛',
    desc: '+15 chips за каждую фигурную карту (J, Q, K)',
    color: '#ffd76a',
    trigger: null
  },
  {
    id: 'double',
    name: 'Двойной шанс',
    icon: '×2',
    desc: 'Первый джокер в слоте даёт ×1.5 mult к итогу',
    color: '#4a9eff',
    trigger: null
  },
  {
    id: 'spade',
    name: 'Пиковый туз',
    icon: '♠',
    desc: '+40 chips, если в комбинации есть пиковый туз',
    color: '#c8c8e0',
    trigger: null
  },
  {
    id: 'last',
    name: 'Последний шанс',
    icon: '⏳',
    desc: 'Если осталась 1 раздача — ×2 mult',
    color: '#ff6aae',
    trigger: null
  },
  {
    id: 'chain',
    name: 'Цепная реакция',
    icon: '⚡',
    desc: 'Каждый джокер слева добавляет +5 chips',
    color: '#b06aff',
    trigger: null
  },
  {
    id: 'discard_bonus',
    name: 'Щедрый сброс',
    icon: '♻',
    desc: '+2 mult за каждый сброс в этом раунде (накопительно)',
    color: '#6affb0',
    trigger: null
  }
];

// Пороги целей по раундам (будут скорректированы генератором)
const ROUND_TARGETS = [300, 550, 900, 1400, 2100, 3000];

/* ------------------------------------------------------------
   2. УТИЛИТЫ
   ------------------------------------------------------------ */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ------------------------------------------------------------
   3. ГЕНЕРАЦИЯ КОЛОДЫ И КАРТ
   ------------------------------------------------------------ */

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// Создать стандартную колоду 52 карты
function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: id++,
        rank,
        suit,
        value: RANK_VALUES[rank],
        isRed: suit === '♥' || suit === '♦'
      });
    }
  }
  return deck;
}

/* ------------------------------------------------------------
   4. ОПРЕДЕЛЕНИЕ ПОКЕРНОЙ КОМБИНАЦИИ
   ------------------------------------------------------------ */

// Принимает массив карт (1–5), возвращает { name, chips, mult }
function evaluateHand(cards) {
  if (!cards || cards.length === 0) {
    return { name: 'High Card', chips: 0, mult: 0 };
  }

  const values = cards.map(c => c.value).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);
  const isFlush = cards.length === 5 && suits.every(s => s === suits[0]);

  // Проверка на стрит (5 карт подряд, с учётом туза как 1)
  let isStraight = false;
  if (cards.length === 5) {
    const uniqueVals = [...new Set(values)];
    if (uniqueVals.length === 5) {
      if (uniqueVals[4] - uniqueVals[0] === 4) isStraight = true;
      // A-2-3-4-5
      if (uniqueVals.join(',') === '2,3,4,5,14') isStraight = true;
    }
  }

  // Подсчёт частот
  const freq = {};
  values.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const counts = Object.values(freq).sort((a, b) => b - a);

  let name = 'High Card';

  if (cards.length === 5) {
    if (isStraight && isFlush) {
      // Роял-флеш: 10, J, Q, K, A одной масти
      const vals = values.join(',');
      if (vals === '10,11,12,13,14') name = 'Royal Flush';
      else name = 'Straight Flush';
    } else if (counts[0] === 4) {
      name = 'Four of a Kind';
    } else if (counts[0] === 3 && counts[1] === 2) {
      name = 'Full House';
    } else if (isFlush) {
      name = 'Flush';
    } else if (isStraight) {
      name = 'Straight';
    } else if (counts[0] === 3) {
      name = 'Three of a Kind';
    } else if (counts[0] === 2 && counts[1] === 2) {
      name = 'Two Pair';
    } else if (counts[0] === 2) {
      name = 'Pair';
    }
  } else if (cards.length === 4) {
    if (counts[0] === 4) name = 'Four of a Kind';
    else if (counts[0] === 3) name = 'Three of a Kind';
    else if (counts[0] === 2 && counts[1] === 2) name = 'Two Pair';
    else if (counts[0] === 2) name = 'Pair';
  } else if (cards.length === 3) {
    if (counts[0] === 3) name = 'Three of a Kind';
    else if (counts[0] === 2) name = 'Pair';
  } else if (cards.length === 2) {
    if (counts[0] === 2) name = 'Pair';
  }

  const base = BASE_VALUES[name] || [0, 0];
  return { name, chips: base[0], mult: base[1] };
}

/* ------------------------------------------------------------
   5. ДЖОКЕРЫ — ЛОГИКА СРАБАТЫВАНИЯ
   ------------------------------------------------------------ */

// Применяет джокеров к базовой комбинации.
// Возвращает { chips, mult, log: [] }
// Порядок важен: джокеры срабатывают слева направо.
function applyJokers(baseChips, baseMult, playedCards, jokers, state) {
  let chips = baseChips;
  let mult = baseMult;
  const log = [];
  const triggered = [];

  for (let i = 0; i < jokers.length; i++) {
    const j = jokers[i];
    if (!j) continue;

    switch (j.id) {
      case 'sev': {
        const count = playedCards.filter(c => c.rank === '7').length;
        if (count > 0) {
          const add = count * 30;
          chips += add;
          log.push(`Семёрка удачи: +${add} chips`);
          triggered.push(j.id);
        }
        break;
      }
      case 'hearts': {
        const hasHearts = playedCards.some(c => c.suit === '♥');
        if (hasHearts) {
          mult *= 2;
          log.push('Черви: ×2 mult');
          triggered.push(j.id);
        }
        break;
      }
      case 'memory': {
        // Учитываем сброшенные карты (накоплено в state.discardedThisRound)
        if (state.discardedThisRound > 0) {
          const add = state.discardedThisRound;
          mult += add;
          log.push(`Память сброса: +${add} mult`);
          triggered.push(j.id);
        }
        break;
      }
      case 'even': {
        const count = playedCards.filter(c => c.value % 2 === 0).length;
        if (count > 0) {
          const add = count * 25;
          chips += add;
          log.push(`Чётный баланс: +${add} chips`);
          triggered.push(j.id);
        }
        break;
      }
      case 'face': {
        const count = playedCards.filter(c => ['J', 'Q', 'K'].includes(c.rank)).length;
        if (count > 0) {
          const add = count * 15;
          chips += add;
          log.push(`Королевский двор: +${add} chips`);
          triggered.push(j.id);
        }
        break;
      }
      case 'double': {
        // Срабатывает, только если это первый джокер в слоте (i === 0)
        if (i === 0) {
          mult = Math.round(mult * 1.5);
          log.push('Двойной шанс: ×1.5 mult');
          triggered.push(j.id);
        }
        break;
      }
      case 'spade': {
        const hasSpadeAce = playedCards.some(c => c.suit === '♠' && c.rank === 'A');
        if (hasSpadeAce) {
          chips += 40;
          log.push('Пиковый туз: +40 chips');
          triggered.push(j.id);
        }
        break;
      }
      case 'last': {
        if (state.handsLeft <= 1) {
          mult *= 2;
          log.push('Последний шанс: ×2 mult');
          triggered.push(j.id);
        }
        break;
      }
      case 'chain': {
        const add = i * 5; // каждый джокер слева даёт +5
        if (add > 0) {
          chips += add;
          log.push(`Цепная реакция: +${add} chips`);
          triggered.push(j.id);
        }
        break;
      }
      case 'discard_bonus': {
        if (state.discardsUsed > 0) {
          const add = state.discardsUsed * 2;
          mult += add;
          log.push(`Щедрый сброс: +${add} mult`);
          triggered.push(j.id);
        }
        break;
      }
    }
  }

  return { chips, mult: Math.round(mult), log, triggered };
}

/* ------------------------------------------------------------
   6. ГЕНЕРАТОР РАУНДОВ (гарантия решаемости)
   ------------------------------------------------------------ */

// Генерирует раунд: возвращает объект с колодой, джокерами, целью.
// Использует обратную генерацию: сначала создаёт «идеальную» раздачу,
// которая гарантированно набирает цель, затем маскирует её в колоде.
function generateRound(roundNumber, unlockedJokers) {
  const target = ROUND_TARGETS[roundNumber - 1] || 500 * roundNumber;
  const handsLimit = BASE_HANDS;
  const discardsLimit = MAX_DISCARDS;

  // Выбираем 2–3 джокера для раунда из доступных
  const jokerCount = roundNumber <= 2 ? 2 : (roundNumber <= 4 ? 3 : 3);
  const availableJokers = JOKER_LIBRARY.filter(j => unlockedJokers.includes(j.id) || unlockedJokers.length === 0);
  const roundJokers = shuffle(availableJokers.length >= jokerCount ? availableJokers : JOKER_LIBRARY)
    .slice(0, jokerCount)
    .map(j => ({ ...j }));

  // Создаём полную колоду и перемешиваем
  let deck = shuffle(createDeck());

  // Ищем «идеальную» комбинацию в колоде, которая с джокерами даст >= target
  // Пробуем разные комбинации из 5 карт, пока не найдём подходящую.
  // Для гарантии: подбираем комбинацию, которая с джокерами даёт хотя бы target / handsLimit * 1.5
  const minPerHand = Math.ceil(target / handsLimit);

  // Функция для перебора всех комбинаций из 5 карт (ограниченно)
  function findWinningCombo(deckCards) {
    // Ограничим перебор: проверим все пары, тройки, стриты, флеши
    // Для эффективности проверим сначала комбинации с высокой базой
    const testSets = [];

    // Все пары
    for (let i = 0; i < deckCards.length; i++) {
      for (let j = i + 1; j < deckCards.length; j++) {
        testSets.push([deckCards[i], deckCards[j]]);
      }
    }
    // Все тройки (ограниченно)
    for (let i = 0; i < Math.min(deckCards.length, 12); i++) {
      for (let j = i + 1; j < Math.min(deckCards.length, 13); j++) {
        for (let k = j + 1; k < Math.min(deckCards.length, 14); k++) {
          testSets.push([deckCards[i], deckCards[j], deckCards[k]]);
        }
      }
    }
    // Пятёрки: ищем флеши и стриты
    for (let i = 0; i < Math.min(deckCards.length, 10); i++) {
      for (let j = i + 1; j < Math.min(deckCards.length, 11); j++) {
        for (let k = j + 1; k < Math.min(deckCards.length, 12); k++) {
          for (let l = k + 1; l < Math.min(deckCards.length, 13); l++) {
            for (let m = l + 1; m < Math.min(deckCards.length, 14); m++) {
              testSets.push([deckCards[i], deckCards[j], deckCards[k], deckCards[l], deckCards[m]]);
            }
          }
        }
      }
    }

    let best = null;
    let bestScore = 0;

    for (const set of testSets) {
      const evalResult = evaluateHand(set);
      const jokerResult = applyJokers(evalResult.chips, evalResult.mult, set, roundJokers, {
        discardedThisRound: 0, handsLeft: handsLimit, discardsUsed: 0
      });
      const total = jokerResult.chips * jokerResult.mult;
      if (total > bestScore) {
        bestScore = total;
        best = { cards: set, evalResult, jokerResult, total };
      }
    }

    return best;
  }

  const winning = findWinningCombo(deck);

  // Если не нашли достаточно сильную комбинацию — усилим джокеров или снизим цель
  let adjustedTarget = target;
  if (!winning || winning.total < minPerHand) {
    // Снижаем цель до реалистичной
    adjustedTarget = Math.max(100, Math.floor((winning ? winning.total : 50) * handsLimit * 0.7));
  }

  // Убедимся, что цель не превышает разумных пределов
  adjustedTarget = Math.min(adjustedTarget, winning ? winning.total * handsLimit : target);

  // Перемешиваем колоду так, чтобы «идеальная» комбинация не лежала подряд
  // (она уже в колоде, просто перемешана — этого достаточно)
  deck = shuffle(deck);

  return {
    deck,
    jokers: roundJokers,
    target: Math.max(150, adjustedTarget),
    handsLimit,
    discardsLimit,
    roundNumber,
    winningCombo: winning
  };
}

/* ------------------------------------------------------------
   7. СОСТОЯНИЕ ИГРЫ
   ------------------------------------------------------------ */

const game = {
  round: 1,
  score: 0,
  target: 0,
  handsLeft: 0,
  discardsLeft: 0,
  deck: [],
  hand: [],
  discardPile: [],
  selected: new Set(),
  jokers: [],
  timerStart: null,
  timerInterval: null,
  totalHandsPlayed: 0,
  totalDiscards: 0,
  discardedThisRound: 0,
  discardsUsed: 0,
  unlockedJokers: [],
  allJokers: [],       // все джокеры, которые были получены за игру
  gameOver: false,
  bestHands: {},       // рекорды: { roundNumber: minHands }
  bestScores: {}       // рекорды: { roundNumber: maxScore }
};

/* ------------------------------------------------------------
   8. DOM-ССЫЛКИ
   ------------------------------------------------------------ */

const el = {
  screens: {
    start: document.getElementById('screen-start'),
    game: document.getElementById('screen-game'),
    result: document.getElementById('screen-result')
  },
  btnStart: document.getElementById('btn-start'),
  btnPlay: document.getElementById('btn-play'),
  btnDiscard: document.getElementById('btn-discard'),
  btnMenu: document.getElementById('btn-menu'),
  btnRestart: document.getElementById('btn-restart'),
  btnToMenu: document.getElementById('btn-to-menu'),
  hand: document.getElementById('hand'),
  jokersRow: document.getElementById('jokers-row'),
  comboName: document.getElementById('combo-name'),
  comboChips: document.getElementById('combo-chips'),
  comboMult: document.getElementById('combo-mult'),
  comboTotal: document.getElementById('combo-total'),
  handInfo: document.getElementById('hand-info'),
  hudRound: document.getElementById('hud-round'),
  hudTimer: document.getElementById('hud-timer'),
  hudScore: document.getElementById('hud-score'),
  hudTarget: document.getElementById('hud-target'),
  hudHands: document.getElementById('hud-hands'),
  hudDiscards: document.getElementById('hud-discards'),
  log: document.getElementById('log'),
  resultTitle: document.getElementById('result-title'),
  resultSubtitle: document.getElementById('result-subtitle'),
  resultStats: document.getElementById('result-stats'),
  recordsPreview: document.getElementById('records-preview'),
  flash: null // создаём динамически
};

/* ------------------------------------------------------------
   9. УПРАВЛЕНИЕ ЭКРАНАМИ
   ------------------------------------------------------------ */

function showScreen(name) {
  Object.values(el.screens).forEach(s => s.classList.remove('active'));
  if (el.screens[name]) el.screens[name].classList.add('active');
}

/* ------------------------------------------------------------
   10. ТАЙМЕР
   ------------------------------------------------------------ */

function startTimer() {
  if (game.timerInterval) clearInterval(game.timerInterval);
  game.timerStart = Date.now();
  game.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - game.timerStart) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    el.hudTimer.textContent = `${min}:${sec}`;
  }, 500);
}

function stopTimer() {
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }
}

function getElapsedSeconds() {
  if (!game.timerStart) return 0;
  return Math.floor((Date.now() - game.timerStart) / 1000);
}

/* ------------------------------------------------------------
   11. ЛОГ
   ------------------------------------------------------------ */

function addLog(text, className) {
  const div = document.createElement('div');
  if (className) div.className = className;
  div.innerHTML = text;
  el.log.appendChild(div);
  // Ограничим журнал 30 записями
  while (el.log.children.length > 30) {
    el.log.removeChild(el.log.firstChild);
  }
  el.log.scrollTop = el.log.scrollHeight;
}

/* ------------------------------------------------------------
   12. ОТРИСОВКА
   ------------------------------------------------------------ */

function renderHand() {
  el.hand.innerHTML = '';
  game.hand.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.isRed ? 'red' : 'black'}`;
    if (game.selected.has(idx)) cardEl.classList.add('selected');
    cardEl.style.animationDelay = `${idx * 0.04}s`;
    cardEl.dataset.index = idx;

    cardEl.innerHTML = `
      <div class="corner top">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
      <span class="pip">${card.suit}</span>
      <div class="corner bottom">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
    `;

    cardEl.addEventListener('click', () => toggleCard(idx));
    el.hand.appendChild(cardEl);
  });
}

function renderJokers(triggeredIds = []) {
  el.jokersRow.innerHTML = '';
  const totalSlots = 5;
  for (let i = 0; i < totalSlots; i++) {
    const joker = game.jokers[i];
    const div = document.createElement('div');
    div.className = 'joker-card';
    if (!joker) {
      div.classList.add('empty');
      div.innerHTML = `<span class="joker-icon" style="color:#666">◇</span><span class="joker-name">пусто</span>`;
    } else {
      if (triggeredIds.includes(joker.id)) div.classList.add('triggered');
      div.style.color = joker.color;
      div.innerHTML = `
        <span class="joker-icon">${joker.icon}</span>
        <span class="joker-name">${joker.name}</span>
      `;
      div.title = joker.desc;
    }
    el.jokersRow.appendChild(div);
  }
}

function updateHUD() {
  el.hudRound.textContent = `${game.round} / ${TOTAL_ROUNDS}`;
  el.hudScore.textContent = game.score;
  el.hudTarget.textContent = game.target;
  el.hudHands.textContent = game.handsLeft;
  el.hudDiscards.textContent = game.discardsLeft;
}

function updateComboPreview() {
  const selectedCards = [...game.selected].map(i => game.hand[i]);
  if (selectedCards.length === 0) {
    el.comboName.textContent = '—';
    el.comboChips.textContent = '0';
    el.comboMult.textContent = '0';
    el.comboTotal.textContent = '0';
    el.btnPlay.disabled = true;
    el.btnDiscard.disabled = true;
    el.handInfo.textContent = 'Выбрано: 0';
    return;
  }

  const evalResult = evaluateHand(selectedCards);
  const jokerResult = applyJokers(evalResult.chips, evalResult.mult, selectedCards, game.jokers, {
    discardedThisRound: game.discardedThisRound,
    handsLeft: game.handsLeft,
    discardsUsed: game.discardsUsed
  });

  el.comboName.textContent = COMBO_RU[evalResult.name] || evalResult.name;
  el.comboChips.textContent = jokerResult.chips;
  el.comboMult.textContent = jokerResult.mult;
  el.comboTotal.textContent = jokerResult.chips * jokerResult.mult;
  el.handInfo.textContent = `Выбрано: ${selectedCards.length} / ${MAX_PLAY}`;

  el.btnPlay.disabled = false;
  el.btnDiscard.disabled = game.discardsLeft <= 0 || game.handsLeft <= 0;
}

/* ------------------------------------------------------------
   13. ВЫБОР КАРТ
   ------------------------------------------------------------ */

function toggleCard(index) {
  if (game.gameOver) return;

  if (game.selected.has(index)) {
    game.selected.delete(index);
  } else {
    if (game.selected.size >= MAX_PLAY) return; // максимум 5 карт
    game.selected.add(index);
  }

  // Обновляем визуальное выделение без полного ререндера
  const cards = el.hand.querySelectorAll('.card');
  cards.forEach((c, i) => {
    if (game.selected.has(i)) c.classList.add('selected');
    else c.classList.remove('selected');
  });

  updateComboPreview();
}

/* ------------------------------------------------------------
   14. ИГРА КОМБИНАЦИИ
   ------------------------------------------------------------ */

function playHand() {
  if (game.gameOver || game.selected.size === 0) return;
  if (game.handsLeft <= 0) return;

  const indices = [...game.selected].sort((a, b) => a - b);
  const playedCards = indices.map(i => game.hand[i]);

  // Оцениваем комбинацию
  const evalResult = evaluateHand(playedCards);
  const jokerResult = applyJokers(evalResult.chips, evalResult.mult, playedCards, game.jokers, {
    discardedThisRound: game.discardedThisRound,
    handsLeft: game.handsLeft,
    discardsUsed: game.discardsUsed
  });

  const handScore = jokerResult.chips * jokerResult.mult;

  // Добавляем счёт
  game.score += handScore;
  game.handsLeft--;
  game.totalHandsPlayed++;

  // Логируем
  addLog(
    `<span class="log-score">${COMBO_RU[evalResult.name] || evalResult.name}</span>: ` +
    `${jokerResult.chips} chips × ${jokerResult.mult} mult = <span class="log-score">${handScore}</span>`,
    ''
  );
  jokerResult.log.forEach(l => addLog(`↳ ${l}`, 'log-joker'));

  // Анимация сработавших джокеров
  renderJokers(jokerResult.triggered);

  // Пульсация множителя
  if (jokerResult.mult > evalResult.mult) {
    el.comboMult.classList.add('pulse');
    setTimeout(() => el.comboMult.classList.remove('pulse'), 500);
  }

  // Вспышка при крупном счёте
  if (handScore >= 200) {
    triggerFlash();
  }

  // Сбрасываем выбранные карты и добираем новые
  const newHand = game.hand.filter((_, i) => !indices.includes(i));

  // Анимация сброса
  const cards = el.hand.querySelectorAll('.card');
  indices.forEach(i => {
    if (cards[i]) cards[i].classList.add('discarding');
  });

  // Сброс карт в колоду (перемешиваем)
  playedCards.forEach(c => game.deck.push(c));
  game.deck = shuffle(game.deck);

  // Добираем столько же карт
  const need = indices.length;
  for (let i = 0; i < need && game.deck.length > 0; i++) {
    newHand.push(game.deck.pop());
  }

  setTimeout(() => {
    game.hand = newHand;
    game.selected.clear();
    renderHand();
    renderJokers();
    updateHUD();
    updateComboPreview();

    // Проверка победы/поражения
    if (game.score >= game.target) {
      roundWin();
    } else if (game.handsLeft <= 0) {
      gameLose();
    }
  }, 420);
}

/* ------------------------------------------------------------
   15. СБРОС КАРТ
   ------------------------------------------------------------ */

function discardSelected() {
  if (game.gameOver || game.selected.size === 0 || game.discardsLeft <= 0) return;

  const indices = [...game.selected].sort((a, b) => a - b);
  const discardedCards = indices.map(i => game.hand[i]);

  // Увеличиваем счётчики сброса
  game.discardsLeft--;
  game.totalDiscards++;
  game.discardedThisRound += discardedCards.length;
  game.discardsUsed++;

  addLog(`Сброшено ${discardedCards.length} карт`, 'log-joker');

  // Убираем из руки
  const newHand = game.hand.filter((_, i) => !indices.includes(i));

  // Карты в сброс (в колоду)
  discardedCards.forEach(c => game.deck.push(c));
  game.deck = shuffle(game.deck);

  // Добираем
  const need = indices.length;
  for (let i = 0; i < need && game.deck.length > 0; i++) {
    newHand.push(game.deck.pop());
  }

  // Анимация
  const cards = el.hand.querySelectorAll('.card');
  indices.forEach(i => {
    if (cards[i]) cards[i].classList.add('discarding');
  });

  setTimeout(() => {
    game.hand = newHand;
    game.selected.clear();
    renderHand();
    updateHUD();
    updateComboPreview();
  }, 380);
}

/* ------------------------------------------------------------
   16. ВСПЫШКА
   ------------------------------------------------------------ */

function triggerFlash() {
  if (!el.flash) {
    el.flash = document.createElement('div');
    el.flash.className = 'screen-flash';
    document.body.appendChild(el.flash);
  }
  el.flash.classList.remove('active');
  void el.flash.offsetWidth; // reflow
  el.flash.classList.add('active');
}

/* ------------------------------------------------------------
   17. ПЕРЕХОДЫ РАУНДОВ
   ------------------------------------------------------------ */

function roundWin() {
  game.gameOver = true;
  stopTimer();

  addLog(`<span class="log-round">Раунд ${game.round} пройден!</span>`, 'log-round');

  // Сохраняем рекорд
  saveRecord(game.round, game.score, game.totalHandsPlayed);

  // Открываем нового джокера
  const unlocked = unlockJoker();

  if (game.round >= TOTAL_ROUNDS) {
    // Победа в игре
    showResult(true);
    return;
  }

  // Показываем сообщение о победе в раунде и переходим дальше
  setTimeout(() => {
    game.round++;
    if (unlocked) {
      addLog(`Получен джокер: <span class="log-joker">${unlocked.name}</span>`, 'log-joker');
    }
    startRound();
  }, 800);
}

function gameLose() {
  game.gameOver = true;
  stopTimer();
  addLog(`<span style="color:#ff6a8a">Поражение. Счёт ${game.score} из ${game.target}</span>`, '');
  saveRecord(game.round, game.score, game.totalHandsPlayed);
  showResult(false);
}

function unlockJoker() {
  // Выбираем случайного джокера, которого ещё нет в разблокированных
  const available = JOKER_LIBRARY.filter(j => !game.unlockedJokers.includes(j.id));
  if (available.length === 0) return null;
  const unlocked = pickRandom(available);
  game.unlockedJokers.push(unlocked.id);
  return unlocked;
}

/* ------------------------------------------------------------
   18. СТАРТ РАУНДА
   ------------------------------------------------------------ */

function startRound() {
  const roundData = generateRound(game.round, game.unlockedJokers);

  game.deck = roundData.deck;
  game.jokers = roundData.jokers;
  game.target = roundData.target;
  game.handsLeft = roundData.handsLimit;
  game.discardsLeft = roundData.discardsLimit;
  game.score = 0;
  game.selected.clear();
  game.discardedThisRound = 0;
  game.discardsUsed = 0;
  game.gameOver = false;

  // Раздаём руку
  game.hand = [];
  for (let i = 0; i < HAND_SIZE && game.deck.length > 0; i++) {
    game.hand.push(game.deck.pop());
  }

  // Обновляем UI
  renderHand();
  renderJokers();
  updateHUD();
  updateComboPreview();

  el.log.innerHTML = '';
  addLog(`<span class="log-round">Раунд ${game.round}</span>: цель ${game.target}`, 'log-round');
  addLog(`Джокеры: ${game.jokers.map(j => j.name).join(', ')}`, '');
  if (roundData.winningCombo) {
    addLog(`Оптимальная комбинация: ${COMBO_RU[roundData.winningCombo.evalResult.name]}`, '');
  }

  if (!game.timerInterval) startTimer();
}

/* ------------------------------------------------------------
   19. РЕЗУЛЬТАТЫ
   ------------------------------------------------------------ */

function showResult(isWin) {
  const elapsed = getElapsedSeconds();
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;

  if (isWin) {
    el.resultTitle.textContent = 'Победа';
    el.resultTitle.classList.remove('lose');
    el.resultSubtitle.textContent = 'Все 6 раундов пройдены. Мастерство безупречно.';
  } else {
    el.resultTitle.textContent = 'Поражение';
    el.resultTitle.classList.add('lose');
    el.resultSubtitle.textContent = `Раунд ${game.round} оказался непреодолимым.`;
  }

  el.resultStats.innerHTML = `
    <div>Пройдено раундов: <b>${isWin ? TOTAL_ROUNDS : game.round - 1} / ${TOTAL_ROUNDS}</b></div>
    <div>Финальный счёт: <b>${game.score}</b></div>
    <div>Сыграно комбинаций: <b>${game.totalHandsPlayed}</b></div>
    <div>Сбросов: <b>${game.totalDiscards}</b></div>
    <div>Время партии: <b>${min} мин ${sec} сек</b></div>
  `;

  showScreen('result');
}

/* ------------------------------------------------------------
   20. LOCALSTORAGE — РЕКОРДЫ
   ------------------------------------------------------------ */

function saveRecord(roundNumber, score, handsPlayed) {
  const key = 'jokers_patience_records';
  let records = {};
  try {
    records = JSON.parse(localStorage.getItem(key)) || {};
  } catch (e) { records = {}; }

  const rKey = `round_${roundNumber}`;
  if (!records[rKey]) {
    records[rKey] = { bestScore: score, minHands: handsPlayed };
  } else {
    if (score > records[rKey].bestScore) records[rKey].bestScore = score;
    if (handsPlayed < records[rKey].minHands) records[rKey].minHands = handsPlayed;
  }

  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch (e) { /* ignore */ }

  updateRecordsPreview();
}

function updateRecordsPreview() {
  const key = 'jokers_patience_records';
  let records = {};
  try {
    records = JSON.parse(localStorage.getItem(key)) || {};
  } catch (e) { records = {}; }

  if (Object.keys(records).length === 0) {
    el.recordsPreview.innerHTML = '<span style="opacity:0.5">Рекордов пока нет</span>';
    return;
  }

  let html = '<div style="margin-top:4px;text-transform:uppercase;letter-spacing:0.1em;font-size:0.6rem;opacity:0.5">Рекорды</div>';
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const rec = records[`round_${r}`];
    if (rec) {
      html += `<div>Раунд ${r}: лучший счёт <b style="color:#ffd76a">${rec.bestScore}</b>, минимум ходов <b style="color:#6affb0">${rec.minHands}</b></div>`;
    }
  }
  el.recordsPreview.innerHTML = html;
}

/* ------------------------------------------------------------
   21. СТАРТ ПАРТИИ
   ------------------------------------------------------------ */

function startGame() {
  // Сброс состояния
  game.round = 1;
  game.score = 0;
  game.totalHandsPlayed = 0;
  game.totalDiscards = 0;
  game.discardedThisRound = 0;
  game.discardsUsed = 0;
  game.unlockedJokers = [];
  game.gameOver = false;
  game.timerStart = null;
  stopTimer();
  el.hudTimer.textContent = '00:00';

  showScreen('game');
  startRound();
}

/* ------------------------------------------------------------
   22. ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ
   ------------------------------------------------------------ */

function init() {
  updateRecordsPreview();

  el.btnStart.addEventListener('click', startGame);
  el.btnPlay.addEventListener('click', playHand);
  el.btnDiscard.addEventListener('click', discardSelected);

  el.btnMenu.addEventListener('click', () => {
    stopTimer();
    showScreen('start');
    updateRecordsPreview();
  });

  el.btnRestart.addEventListener('click', startGame);

  el.btnToMenu.addEventListener('click', () => {
    stopTimer();
    showScreen('start');
    updateRecordsPreview();
  });

  // Горячие клавиши
  document.addEventListener('keydown', (e) => {
    if (!el.screens.game.classList.contains('active')) return;
    if (e.key === 'Enter') playHand();
    if (e.key === 'Backspace') {
      e.preventDefault();
      discardSelected();
    }
    if (e.key === 'Escape') {
      game.selected.clear();
      renderHand();
      updateComboPreview();
    }
  });
}

// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', init);