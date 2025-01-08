'use strict';

class Nine {
  static SuitStr = ['♦','♠','♥','♣'];
  static SuitClass = ['dia', 'spade', 'heart', 'club'];
  static RankStr = ['A','K','Q','J','10','9',  '8'];
  constructor(rank_length = 6) {
    this.deck = 0;
    this.rank_length = rank_length == 6 || rank_length == 7? rank_length: 6;
    this.deck_length = this.rank_length * 4;
  }
  static pInit  = 0;
  static pDeal  = 1;
  static pBid   = 2;
  static pPlay  = 3;
  static pScore = 4;
  static pEnd   = 5;
  static pNext  = 6;
  new_game() {
    this.score = 0;
    this.deal_count = 0;
    this.deck = (1 << this.deck_length) - 1;
    this.hand = 0;
    this.lead = 0;
    this.trump = 0;
    this.bid = 0;
    this.tricks = 0;
    // 次のフェーズ
    this.phase = Nine.pDeal;
  }
  next_game() {
    this.deck = (1 << this.deck_length) - 1;
    this.hand = 0;
    this.lead = 0;
    this.trump = 0;
    this.bid = 0;
    this.tricks = 0;
    // 次のフェーズ
    this.phase = Nine.pDeal;
  }
  deal_cards() {
    this.deal_count += 1;
    this.trump = this.deal();
    for (let i = 0; i < 12; ++i) {
      this.hand |= this.deal();
    }
    // 次のフェーズ
    this.phase = Nine.pBid;
  }
  bid(bid_bits) {
     if ((this.hand & bid_bits) != bid_bits) {
       console.error(this.hand, bid_bits);
       throw new Error('panic');
     }
    if (Nine.popcount(bid_bits) != 3) {
      throw new Error('ビッドは手札３枚で行います');
    }
    // 手札から消す
    this.hand &= ~bid_bits;
    this.bid = this.bid_to_num(bid_bits);
    // 次のフェーズ
    this.phase = Nine.pPlay;
  }
  // プレイヤーが勝った / 負けた
  static TrickWin = true;
  static TrickLose = false;
  play(sel_card) {
    if (this.phase != Nine.pPlay || (this.hand & sel_card) == 0) {
       console.error(this.hand, sel_card);
       throw new Error('panic');
    }
    // 消す
    this.hand &= ~sel_card;
    if (this.hand == 0) {
      this.phase = Nine.pScore;
    }
    //
    const lead = this.to_card(this.lead);
    const card = this.to_card(sel_card);
    if (lead.suit == card.suit) {
      if (card.rank < lead.rank) { // 小さい方の勝ちA=0, K=1
        this.add_trick();
        return Nine.TrickWin;
      }
      return Nine.TrickLose;
    } else {
      const trump = this.to_card(this.trump);
      if (trump.suit == card.suit) {
        this.add_trick();
        return Nine.TrickWin; // leadがtrumpは上で検証
      } else {
        return Nine.TrickLose;
      }
    }
  }
  calc_score() {
    const done = this.tricks == this.bid;
    const bonus = (done? 10: 0);
    this.score += bonus + this.tricks;
    this.phase = done? Nine.pNext: Nine.pEnd;
    return {
      bonus: bonus,
      tricks: this.tricks,
      next: done,
    };
  }
  ////////////////////////////////////////////////////////////////////////
  add_trick() {
    this.tricks += 1;
  }
  deal() {
    this.deck &= (1 << this.deck_length) - 1;
    while (this.deck != 0) {
      const r = 1 << Math.trunc(Math.random() * this.deck_length);
      if (this.deck & r) {
        this.deck &= ~r;
        return r;
      }
    }
    throw new Error('deal: deck empty');
  }
  bid_to_num(bid) {
    let sum = 0;
    for (let card_bit of this.each_cards(bid)) {
      const card = this.to_card(card_bit);
      sum += card.suit; // 0..♦, 1..♠, 2..♥, 3..♣
    }
    return sum;
  }
  static popcount(x) {
    const a = x - (x >>> 1 & 0x55555555);
    const b = (a & 0x33333333) + (a >>> 2 & 0x33333333);
    const c = b + (b >>> 4) & 0x0f0f0f0f;
    const y = c * 0x01010101 >>> 24;
    return y;
  };
  create_card(card_bit) {
    //if (Nine.popcount(card_bit) != 1) throw new Error('panic');
    const n = Nine.popcount(card_bit - 1);
    const s = Math.trunc(n / this.rank_length);
    const r = n % this.rank_length;
    return {
      bit: card_bit,
      suit: s,
      rank: r,
      suit_str: Nine.SuitStr[ s ],
      suit_class: Nine.SuitClass[ s ],
      rank_str: Nine.RankStr[ r ],
    };
  }
  to_card(card_bit) {
    //if (Nine.popcount(card_bit) != 1) throw new Error('panic');
    const n = Nine.popcount(card_bit - 1);
    return {
      suit: Math.trunc(n / this.rank_length), // 0..♦, 1..♠, 2..♥, 3..♣
      rank: n % this.rank_length,
    };
  }
  *each_cards(hand_bit = this.hand) {
    for (let hand = hand_bit; hand != 0; ) {
      const card = hand & -hand;
      yield card;
      hand &= ~card;
    }
  }
  get_legal() {
    const lead  = this.to_card(this.lead);
    let f_cards = 0;
    let d_cards = 0;
    for (let cur of this.each_cards()) {
      const card = this.to_card(cur);
      if (lead.suit == card.suit) {
        f_cards |= cur;
      } else {
        d_cards |= cur;
      }
    }
    return f_cards == 0? d_cards: f_cards;
  }
  get_hand_len() {
    return Nine.popcount(this.hand);
  }
}// class





