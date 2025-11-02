# 事前ルール（LLMに最初に伝える共通方針）

* コメントは日本語、簡潔→詳細の順（`@brief`→`@details`）。
* 仕様が曖昧な箇所は推測せず中立記述＋`@todo`で明示。
* 可能なかぎり副作用・計算量・例外・境界条件・スレッド安全性を記述。
* タグ：`@file, @brief, @details, @author, @date, @copyright,
  @version, @ingroup, @tparam, @param, @return, @retval, @throws, @since, @warning, @note, @see, @todo`
* スタイル：ファイル/型/関数は `/** ... */` または `///`、メンバ末尾は `///<`、行単位処理は `//!` を使用。

---

# 1) ファイルコメント

- ソースファイル全体に対して、Doxygenのファイルヘッダブロックを書いてください。
	`@file`, `@brief`, `@details`, `@author`,`@date`, `@version`, `@copyright`,
- 必要があれば `@ingroup`, `@see`, `@warning`, `@todo` を含めます。
- 目的・入出力・利用例の最短コードスニペット（任意）を`@details`に含め、曖昧な点は推測せず`@todo`で明示。

**出力例**

```cpp
/**
 * @file vec_stats.cpp
 * @brief 数列の要約統計量（平均・分散など）を提供するユーティリティ。
 * @details
 * 本モジュールは小規模データ向けの単純な集計関数を提供します。
 * 例:
 * @code
 * std::vector<double> xs{1,2,3,4};
 * auto m = mean(xs);      // 2.5
 * auto v = variance(xs);  // 1.25
 * @endcode
 * 制約: NaN/Inf を含む入力の扱いは未定義。@todo NaN含有時の方針を定義。
 * @author <名前>
 * @date <作成した日にする>
 * @version <前回のバージョンから上げていくこと。開始は、0.1>
 * @copyright MIT
 * @see mean, variance
 */
#include <vector>
#include <numeric>
#include <stdexcept>
```

---

# 2) クラス／構造体コメント
クラス/構造体定義にDoxygenコメントを追加してください。
- `@brief`, `@details`
- テンプレート引数は `@tparam`
- 公開APIはメソッドごとに`@param`, `@return`, `@throws`
- メンバには末尾`///<`で役割を記述。計算量・例外・スレッド安全性・不変条件を明記。コメントは日本語。

**出力例**

```cpp
/**
 * @brief 固定容量の循環バッファ。
 * @details
 * 先入れ先出し（FIFO）。push/popは平均O(1)。スレッド安全ではありません。
 * @tparam T 要素型。コピー可能であること。
 */
template <class T>
class RingBuffer {
public:
    /**
     * @brief 容量を指定してバッファを構築する。
     * @param capacity 要素数の最大容量。0は未定義動作。@warning 0は使用不可。
     */
    explicit RingBuffer(size_t capacity);

    /**
     * @brief 末尾に要素を追加する。
     * @param v 追加する要素。
     * @throws std::overflow_error バッファが満杯のとき。
     */
    void push(const T& v);

    /**
     * @brief 先頭要素を取り出す。
     * @return 取り出した要素。
     * @throws std::underflow_error バッファが空のとき。
     */
    T pop();

    /// @brief バッファが空かどうか。
    bool empty() const;

    /// @brief バッファが満杯かどうか。
    bool full() const;

private:
    std::vector<T> buf_;   ///< 実体配列。
    size_t head_{0};       ///< 次に書き込む位置。
    size_t tail_{0};       ///< 次に読み出す位置。
    size_t size_{0};       ///< 現在の要素数。
    size_t cap_;           ///< 容量（不変条件: cap_ > 0）。
};
```

---

# 3) 関数コメント
関数にDoxygenコメントを付けてください。
- `@brief`, `@details`
- すべての引数に`@param`
- 戻り値に`@return`または`@retval`
- 投げうる例外に`@throws`
- 計算量・事前条件・事後条件・副作用・境界条件を記載。
- 未確定事項は`@todo`。日本語。

**出力例**

```cpp
/**
 * @brief 標本の分散（母分散ではなく不偏分散ではない）を計算する。
 * @details
 * 現在は N で割る実装（不偏推定ではない）。@todo 不偏分散(N-1)対応のオプション化。
 * 計算量は O(N)。
 * @param xs 実数列。NaN/Inf を含むと結果は未定義。
 * @return 分散値。
 * @throws std::invalid_argument 要素数が2未満のとき。
 * @see mean
 */
double variance(const std::vector<double>& xs) {
    if (xs.size() < 2) throw std::invalid_argument("need >=2");
    double m = std::accumulate(xs.begin(), xs.end(), 0.0) / xs.size();
    double s = 0.0;
    for (double x : xs) s += (x - m) * (x - m);
    return s / static_cast<double>(xs.size());
}
```

---

# 4) 各処理（行・ブロック）へのコメント
- 関数の内部処理に、読解補助のための行単位/ブロック単位のDoxygenコメントを付けてください。
- 重要な不変条件・境界処理・アルゴリズムの要点を `//!` で行上に、メンバ末尾には `///<`。
- 冗長な自明説明は避け、意図・理由・前提を記述。

**出力例**

```cpp
/**
 * @brief 昇順配列に対する lower_bound の添字を返す（二分探索）。
 * @param a 昇順にソートされた配列。
 * @param key 挿入位置を求めるキー。
 * @return 最初に key 以上となる位置（0..a.size()）。
 * @warning a は昇順であること（前提）。未満の場合は未定義動作。
 */
int lower_bound_index(const std::vector<int>& a, int key) {
    int lo = 0, hi = (int)a.size();
    //! ループ不変条件: 目的位置は常に [lo, hi) に存在する
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;  //! オーバーフロー回避のための中点計算
        if (a[mid] < key)
            lo = mid + 1;              //! mid は解に含まれない → 下側を狭める
        else
            hi = mid;                  //! mid は候補 → 上側を狭める
    }
    //! ループ終了時: lo == hi が最小の解
    return lo;
}
```
