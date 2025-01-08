'use strict';
// python -m SimpleHTTPServer 8000
class View {
  constructor() {
    const is7 = (new URL(window.location.href).searchParams.get('deck')) == '7';
    //
    this.history_key = 'history' + (is7? '7': '');
    const h_obj = localStorage.getItem(this.history_key);
    this.history = h_obj != null? JSON.parse(h_obj): [];
    if (this.history.length) {
      this.draw_ranking();
    }
    //
    this.nine = new Nine(is7? 7: 6);
    this.nine.new_game();
    //
    this.bid_button = document.getElementById('bid_button');
    this.bid_button.addEventListener('click', this.start_click(), {'once': true});
    //
    this.game_msg = document.getElementById('game_msg');
    //
    this.deck_cnt    = document.getElementById('deck_cnt');
    this.deck_cnt.innerText = this.nine.deck_length;
    this.yamahuda    = document.getElementById('yamahuda');
    this.trump       = document.getElementById('trump');
    this.player_hand = document.getElementById('player_hand');
    this.opp_card    = document.getElementById('opp_card');
    this.played_hand = document.getElementById('played_hand');
    //
    this.card_lock = true;
  }

  ////////////////////////////////
  deal() {
    this.bid_card_cnt = 0;
    this.nine.deal_cards();
    for (let bit of this.nine.each_cards()) {
      const card = this.nine.create_card(bit);
      const card_div = document.createElement('div');
      card_div.classList.add('trump_card');
      card_div.card_info = card;
      card_div.addEventListener('click', this.set_bid_sel());
      this.player_hand.appendChild( this.set_card_face(card_div, card) );
    }
    this.set_card_face( this.trump, this.nine.create_card(this.nine.trump) );
    this.trump.classList.remove('card_blank');
    this.show_nokori(9);
    this.set_button_state('Bid: 0', false);
  }

  ////////////////////////////////
  // action
  calc_bid() {
    let bid = 0;
    let cnt = 0;
    for (let el of this.player_hand.children) {
      if (el.classList.contains('sel_for_bid')) {
        bid += el.card_info.suit;
        cnt += 1;
      }
    }
    return {
      cnt: cnt,
      bid: bid,
    };
  }
  del_hand(card_el) {
    this.nine.hand &= ~card_el.card_info.bit;
    this.player_hand.removeChild(card_el);
  }
  sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
  }
  async wait_play() {
    await this.sleep(1000);
    // 消す
    this.del_card_face(this.played_hand);
    this.del_card_face(this.opp_card);
    this.played_hand.classList.add('card_blank');
    this.opp_card.classList.add('card_blank');
    // プレイが終わった？
    if (this.nine.phase == Nine.pScore) {
      const s = this.nine.calc_score();
      this.mes(s.next? 'ビッド成功！': 'ビッド失敗 - Game Over -');
      await this.sleep(2000);
      this.mes(`Score: ${this.nine.score}  (+${s.tricks} tricks,  +${s.bonus} bonus)`);

      /////////////////////////////////////
      // trump消す, 山札戻す
      this.del_card_face(this.trump);
      this.trump.classList.add('card_blank');
      this.show_nokori(this.nine.deck_length);
      // new or next game
      if (s.next) {
        this.nine.next_game();
      } else {
        this.history.push({
          score: this.nine.score,
          deal: this.nine.deal_count,
          day: new Date()
        });
        this.sort_ranking();
        localStorage.setItem(this.history_key, JSON.stringify(this.history));
        this.draw_ranking(false);
        this.nine.new_game();
      }
      // 次のゲームを有効にする
      this.bid_button.addEventListener('click', this.start_click(), {'once': true});
      this.bid_button.innerText = s.next? 'NEXT': 'START';
      this.bid_button.disabled = false;
    } else {
      await this.sleep(500);
      this.show_play_state();
      this.play_opp_card();
      this.card_lock = false;
    }
  }
  // 手札の動作
  set_bid_sel() {
    return (e) => {
      if (this.card_lock) return;
      // イベントを設置したカードオブジェクト
      const el = e.currentTarget;
      if (this.nine.phase == Nine.pBid) {
        const bid = this.calc_bid();
        el.classList.toggle('sel_for_bid');
        // ボタンの表示を更新
        const new_bid = this.calc_bid();
        this.set_button_state(`BID: ${new_bid.bid}`, new_bid.cnt != 3);
      } else {
        // playとして手札をクリック
        // ビッドに使ったカードはこのイベントを発行しない
        const legal = this.nine.get_legal();
        if ((legal & el.card_info.bit) != 0) {
          // 出せる
          const win = this.nine.play(el.card_info.bit);
          this.mes(win? (this.nine.tricks > this.nine.bid?
            `${this.nine.tricks} trick 目...`:
            `${this.nine.tricks} trick 目を獲得`): 'トリックを逃しました');
          // 手元から消して
          this.del_hand(el);
          // テーブルに表示
          this.played_hand.classList.remove('card_blank');
          this.set_card_face(this.played_hand, el.card_info);
          // wait
          this.card_lock = true;
          this.wait_play(el);
        } else {
          this.mes('Follow できるカードがあります');
        }
      }
    };
  }
  show_play_state() {
    this.mes(
      `Deal ${this.nine.deal_count}: ${this.nine.tricks}/${this.nine.bid} - ${this.nine.score + this.nine.tricks}pt`
    );
  }
  // ボタンの動作
  do_bid() {
    return (e) => {
      const b = this.calc_bid();
      if (b.cnt != 3) throw new Error('panic');
      // remove cards
      const kill = [];
      for (let el of this.player_hand.children) {
        if (el.classList.contains('sel_for_bid')) {
          kill.push(el);
          this.nine.hand &= ~el.card_info.bit;
        }
      }
      for (let el of kill) {
        this.player_hand.removeChild(el);
      }
      if (Nine.popcount(this.nine.hand) != 9) {
        throw new Error(`panic: this.nine.hand: ${this.nine.hand}`);
      }
      /////////////////////////////////////////////////////////////
      //
      // bid が決まった
      //
      // button-> next or new game
      this.bid_button.disabled = true; // クリック不可能にする
      //
      this.nine.bid = b.bid;
      // play
      this.show_play_state(); // 画面に表示: Deal n - tricks/bid (score)
      // フェーズの移動
      this.nine.phase = Nine.pPlay;
      // 敵の最初の１枚目をめくる
      this.play_opp_card();
    };
  }
  // 敵の山札を１枚めくる
  play_opp_card() {
    if (this.nine.hand != 0) {
      this.nine.lead = this.nine.deal();
      this.opp_card.classList.remove('card_blank');
      this.set_card_face(this.opp_card, this.nine.create_card(this.nine.lead));
      this.show_nokori(this.nine.get_hand_len() - 1);
    } else {
      throw new Error('hand = 0');
    }
  }
  start_click() {
    return (e) => {
      this.deal();
      this.mes('手札の 3 枚を Bid に使います: ♦0 ♠1 ♥2 ♣3');
      this.card_lock = false;
      // ビッドボタンを設定
      this.set_button_state('BID: 0', true);
      this.bid_button.addEventListener('click', this.do_bid(), {'once': true});
    };
  }

  ////////////////////////////////
  // draw
  mes(txt) {
    this.game_msg.innerText = txt;
  }
  set_button_state(txt, disabled = false) {
    this.bid_button.innerText = txt;
    this.bid_button.disabled = disabled;
  }
  show_nokori(num) {
    if (num <= 0) {
      this.yamahuda.classList.remove('card_back');
      this.yamahuda.classList.add('card_blank');
      this.deck_cnt.innerText = '';
    } else {
      if (this.yamahuda.classList.contains('card_blank')) {
        this.yamahuda.classList.remove('card_blank');
        this.yamahuda.classList.add('card_back');
      }
      this.deck_cnt.innerText = num;
    }
  }
  del_card_face(ow) {
    while (ow.firstChild) {
      ow.removeChild(ow.firstChild);
    }
  }
  set_card_face(ow, card) {
    // suit
    const suit_p = document.createElement('p');
    suit_p.classList.add(card.suit_class);
    suit_p.innerText = card.suit_str;
    // rank
    const rank_p = document.createElement('p');
    rank_p.classList.add(card.suit_class, 'card_rank');
    rank_p.innerText = card.rank_str;
    // append
    ow.appendChild(suit_p);
    ow.appendChild(rank_p);
    ow.card_info = card;
    //
    return ow;
  }

  ////////////////////////////////
  // history
  sort_ranking() {
    const f = (a, b) => {
      if (a.score != b.score) {
        return b.score - a.score;
      } else if (a.deal != b.deal) {
        return b.deal - a.deal;
      } else {
        return new Date(b.day) - new Date(a.day);
      }
    };
    this.history.sort(f);
    if (this.history.length > 5) {
      this.history = this.history.slice(0, 5);
    }
  }
  draw_ranking(use_sort = true) {
    if (use_sort) {
      this.sort_ranking();
    }
    const len = Math.min(this.history.length, 5);
    for (let i = 0; i < len; ++i) {
      document.getElementById(`hi_${i}_score`).innerText = this.history[i].score;
      document.getElementById(`hi_${i}_day`).innerText =
        new Date(this.history[i].day).toLocaleString('ja-JP');
      document.getElementById(`hi_${i}_deal`).innerText = this.history[i].deal;
    }
  }
}


window.onload = function() {
  const view = new View();
};



