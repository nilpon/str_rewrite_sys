# String Rewriting System Simulator

This is a simple simulator of [string rewriting system](https://en.wikipedia.org/wiki/Semi-Thue_system).

## Usage

### [`str_rewrite_sys.html`](str_rewrite_sys.html) [HTML Preview](http://htmlpreview.github.io/?https://github.com/nilpon/wordprob_js/blob/main/str_rewrite_sys.html)

#### Header
`名前変更`(rename) button changes the name of current monoid.

`新規`(new) button creates new monoid.

`削除`(delete) button delete current monoid.

`全削除`(delete all) button wipes all monoid data.

#### `定義関係式`(Defining relations) tab
You can set defining relation of monoid at `新しい関係式`(new relation) text box.
Just input preferred relation and push `追加`(add) button.

Example: a relation "ab" = "ba" makes "a" and "b" commute.

A relation "aaa" = "" means "a" has order 3.

Each character is considered to denote an indeterminate.
Monoid data does not hold list of generators. A character which never appears
in given relations is simply treated as an indetermiate having no relation with
other indeterminates.

`生成元の位数`(order of generators) button set the order of generators.
First input generators which you want to set order, and input the order of
generators in the second dialog.

`整列`(sort) button sort relations by shortlex order.

`簡約`(reduce) button reduces duplicated relations. This button executes
`TEST_2` in Sims's textbook. After applying this, each left side of relations
does not include any of other left side.

Example: The two relations c = a, xcy = b have redundancy: the left side "xcy"
includes another left side "c" as proper substring. `TEST_2` reduces this
redundancy, in this example it outputs new system of relations: c = a, xay = b.

`Knuth-Bendix` button executes Knuth-Bendix procedure.
CAUTION: This procedure may **NOT TERMINATE!** You can set some restriction
parameters at `設定`(configulation) tab. See `設定`(configulation) section for more
detail.

Currently, `Knuth-Bendix` button OVERWRITE original defining relations.

`全選択`(select all) selects all relations of current monoid.

`消去`(erase) erases selected relations.

`合流的か?`(is confluent) button examine whether current set of defining
relations is confluent. Roughly speaking, confluent means that if you rewrite
a word using relations (only replacing left side to right side is allowed),
at last you will obtain same word regardless of the order of applying
relations.

Example: The set of two relations c = a, c = b is not confluent, because
rewriting "c" using first relation yields the word "a", but on the other hand
rewriting using second relation yields "b", thus the result of rewriting
depends on the choice of relation to apply.

The new set of relations c = b, b = a is confluent. In this case rewriting
"c" terminates at the word "a" regardless of the rewriting process.

`派生Monoid生成`(generate derived monoid) creates new monoid having only
the selected relations. You can backup relation list using this before
executing Knuth-Bendix procedure.

`全組合せで生成`(generate all combination of monoids) generates monoids whose
relations consists of not selected relations and combination of selected
relations. ...useless and may be deleted in the future.

#### `計算`(Calculation)
You can rewrite word graphically here.
If a word is inputted (and pushed `入力` button),
applicable relations will be shown at the bottom of the page.
You can apply preffered relation by pushing `適用`(apply) button.

`元に戻す`(rollback) button rollbacks the last manipulation.

`履歴をクリア`(clear history) wipes the history of manipulation.

If `逆変形`(reverse) box is checked, reverse order rewriting (i.e. replacing
right side to left side of relation) is enabled.

When `挿入`(insert) button is pressed, all candicates of positions of
insertion will be shown. Re-pushing the button closes the list.

#### `公式一覧`(list of formulas)
currently not implemented

#### `設定`(Configulation)
You can set restriction parameters of Knuth-Bendix procedure.
Input preffered value and push `決定`(apply) button to apply it.
Please note that there exists monoids having **NO FINITE CONFLUENT SYSTEM** and
Knuth-Bendix procedure **NEVER SUCCEEDS**.
Also note that resulting system MAY NOT BE CONFLUENT due to the restriction.
You can examine the confluence by `合流的か?`(is confluent) button.

`簡約処理の最大実行回数`(maximum number of applying reduction)
restricts the number of executing `TEST_2` fuction during the procedure.
Default value is 10000. You can somewhat reasonably restrict the execution
time of Knuth-Bendix procedure by this option. The resulting system may not be
confluent if this value is too small.

BE CAREFUL, if this number increases, the execution time of the procedure
may increase **MORE THAN LINEARLY** because each `TEST_2` consumes more time
when the number of relations increases. In general, there is NO UPPER BOUND
of execution time, only the termination of `TEST_2` within finite time is
guaranteed.

Setting the number "0" means no limit. PLEASE NOTE that the procedure
**MAY NOT TERMINATE FOREVER IF NO LIMITATION IS SET**.

`長いoverlapは無視する`(ignore long overlap)
restricts the length of overlaps to be examined.
Setting this value makes the execution time shorter, but the resulting system
may not be confluent when too small value.
Some difficult case requires setting this value appropriately to complete
the Knuth-Bendix procedure within reasonable time (see example data section).
Default value is 50. This value **ENORMOUSLY INCREASES** the execution time
in some cases, so please **be careful when increasing this value!**
Setting the number "0" means no limit. Please note that when larger value or
0 is set, the procedure may take RIDICULOUSLY long time **EVEN IF THE REDUCTION
LIMIT IS SET** because in some weird cases enormous number of relations are
generated when examining long overlaps.


#### `セーブ`(Save)
`エクスポート`(export) button generates save file of monoid data.

`インポート`(import) button load monoid data from selected file.
The structure of save data is currently very simple.

save file format:

`name_of_monoid<relation1_left=relation1_right&relation2_left=...>...`

* Othe files
	* str_rewrite_sys.js: core library of monoids
	* str_rewrite_sys.css: css file
	* tab.js: tab interface


### [shortest_path.cpp](shortest_path.cpp)
`shortest_path` searches the shortest sequence of application of given relations
to make each word empty. Despite of the name of program, output may not be
literally the shortest one because applicable relations are restricted so that
the length of word is limited up to 15 during all the manipulation due to the
constraint of memory. Therefore, there may be more shorter sequence which goes
through longer words, and usually there exists words which cannot be made vanish
even if the monoid defined by given relations is known to be trivial.
This program deals with only rewriting system with generators "a", "b", "c", "d".

#### usage

`./shortest_path [dumpname=/path/to/dumpfile maxdist=d maxlen=l] relation1_left=relation1_right ...`

#### options
	* dumpname: output file name; output is created current directly by default.
	* maxdist: search up to maxdist times of applications of relation; default is 0 (unlimited).
	* maxlen: output about only words whose length is up to maxlen. default is 8.
	maxlen must be <= 15. BEAWARE that output file size is in proportional to 2^maxlen!
	* relations: set relations. For relation of the form word="", "=" can be omitted.
	**only the words consists of "a", "b", "c", "d" is valid.**

#### Memory requirement
`shortest_path` consumes HUGE memory!
It consumes at least 2.7GiB of memory. 
This is because shortest_path holds vertex information (2 byte for each vertex)
for every words whose length is up to 15, whose number is
(4^16-1)/(4-1) - 1 = 1431655764 (empty word is omitted).

It also requires another 1 - 2 GiB for typical flabby case to store the list of
words to be explored next. Moreover, at least
(6 + d) * ((4^(maxlen + 1) - 1) / 3 - 1) bytes of memory is required
to store output data. d := mean length of shortest path, which is typically
at most 200 for very difficult case (but in such a case the number of vanishable
words is tend to small), around 10 for flabby case (almost all words are
vanishable and data will be huge!).
So setting maxlen >= 14 is not recommended.

The output data is binary file, so that next program `view_dump` is needed
to see the content of the file.

The output file consists of the following data.
* list of defining relations
* list of the length of the shortest paths for every words
* the array of offsets for the sequences of shortest paths
* list of sequences of the shortest paths

The structure of output file may be changed near future.

### [view_dump.cpp](view_dump.cpp)
`view_dump` is a viewer for output file of `shortest_path`.

#### usage
`view_dump /path/to/dumpfile [all stat]`

#### options
	* all: output all infomation in the dumpfile. BEAWARE HUGE OUTPUT!
	* stat: output statistics (number of vanishable words, distribution of length)

Implimentation of dump options is still in progress and the usage above may be
changed near future.


## Example data
The `example` directly contains some example data.

* [`basic_english_word.txt`](example/basic_english_word.txt)
	Garbage; you can learn how to erase each letter of alphabet using basic words.
* [`group10752.txt`](example/group10752.txt)
	This example is taken from the Sims's textbook (Example 6.6 of Chapter 2).
	The group defined by given 5 relations is in fact isomorphic to a finite group
	of order 10752. This file also contains the result of Knuth-Bendix.
	To make Knuth-Bendix procedure for the example succeed, you have to set
	restriction options in the 設定(Configulation) tab.
	**Set maximum reduction 0, and maximum overlap 44,** otherwise Knuth-Bendix
	fails. It takes more than 100000 times of `TEST_2` reduction and a couple of
	minutes. If maximum overlap is set to be more than 44, it takes more time.
	You will see 1026 relations as a result under the appropriate configulation.
	You can also confirm the confluence by the 合流的か?(is confluent) button,
	which takes only a few seconds.
* [`trivial.txt`](example/trivial.txt)
	experimental data, almost garbage.
* [`trivial3344.7z`](example/trivial3344.7z)
	Archive of the complete list of 142245 monoids whose defining relations
	consists of	two words of length 3 vanish and two words of length 4 vanish.
	All of them turn out to be trivial, and any monoid generated by 4 elements
	"a", "b", "c", "d" and defining relations of the form described above, which
	turns out to be trivial, coincide with a monoid in the list up to the
	following trivial (anti-)isomorphism of monoids (or rewriting systems):
	* permutation of letters "a", "b", "c", "d",
	* transposition of defining relations,
	* transposition of the order of product (i.e. just reverse all words).

## Reference
C. Sims. "Computation with Finitely Presented Groups",
Encycropedia of Mathematics and its Applications, 
Cambridge University Press, (1994).

## Lisence
[MIT License](https://opensource.org/licenses/MIT).
