/*
  The algorithms for rewriting system of finitely presented monoids
  used here are based on the text of
  C. Sims. "Computation with Finitely Presented Groups",
  Encycropedia of Mathematics and its Applications, Cambridge University Press, (1994).
 */

class Relation {
	constructor(x, y) {
		this.first = x;
		this.second = y;
	}
}

// Relation with trace info
class Relation_t {
	constructor(x, y, hista, histd) {
		this.first = x;
		this.second = y;

		// array of [index, relation_id]
		// someword => x by hist_ascend
		// someword => y by hist_descend
		this.hist_ascend = hista;
		this.hist_descend = histd;
	}
}

function shortlex_order(a, b)
{
  if(a.length == b.length) {
    return a < b;
  }
  else {
    return a.length < b.length;
  }
}

class Monoid {
	constructor() {
		this.relations = [];
		this.relstack = [];
		this.resolve_count = 0;
		this.name = "";

		// to determine whether index_table shoult be reconstructed
		this.relator_changed = true;
		this.is_reduced = false;

		this.gen2id = {}; // generator list (in leftside)
		this.gen_list = [];

		// index automata
		// index_table[state_id][generator_id] = next_state_id
		this.index_table = [];

		// rule identifier function
		// index2relator[state_id] = relator if terminal state, otherwise 0
		this.index2relator = [];
		this.index2length = [];

		// for traceable KB
		this.relation_database = [new Relation_t("", "", [], [])]; // first element is dummy 
		this.relation_id_list = [];
		this.relstack_t = [];

this.show_relation_list_history = false;
	}

	_check_update() {
		if(this.relator_changed) {
			this.is_reduced = this.is_irreducible_system();
			this.generate_index_table();
			this.relator_changed = false;
		}
	}

	reduce_word(w) {
		this._check_update();
		if(this.is_reduced) return this.reduce_word_using_index(w);
		else return this.reduce_word_from_left(w);
	}
  
  reduce_word_from_left(w) {
    let result = w;

		while(
			this.relations.some(
				function(rel) {
					let relator_found = false;
          if(rel.first.length) { // being .first empty means that it is not active
						let ind = result.indexOf(rel.first);
						if(ind >= 0) {
							relator_found = true;
							result = result.substr(0, ind) + rel.second + result.substr(ind + rel.first.length);
						}
          }
          
					return relator_found;
				}
			)
		);

    return result;
  }

	reduce_word_using_index(w) {
		// in case no relation
		if(!this.gen_list.length) return w;

		let result = w;
		let path = [0];
		let pos = 0;

		while(pos < result.length){
			let charid = this.gen2id[result[pos]];
			let state = path[path.length - 1];
			if(charid >= 0) state = this.index_table[state][charid];
			else state = 0; // unknown generator
			path.push(state);
			pos++;
			let relator = this.index2relator[state];
			if(relator) { // found leftside!
				result = result.substr(0, pos - relator.first.length) + relator.second + result.substr(pos);
				path.splice(-relator.first.length);
				pos -= relator.first.length;
			}
		}

		return result;
	}
  
  resolve_relstack() {
    while(this.relstack.length) {
      let rel = this.relstack.pop();
			let new_relator;
    
      rel.first = this.reduce_word_from_left(rel.first);
      rel.second = this.reduce_word_from_left(rel.second);
      if(rel.first !== rel.second) {
        if(shortlex_order(rel.first, rel.second)) {
          new_relator = rel.second;
          rel.second = rel.first;
          rel.first = new_relator;
        }
        else {
          new_relator = rel.first;
        }
        this.relations.push(rel);

        // update all relator *other* than the last 'rel' appended above
        let myrel = this.relations;
        for(let i = 0; i < myrel.length - 1; i++) {
          if(myrel[i].first.length) {
            if(myrel[i].first.indexOf(new_relator) >= 0) {
              this.relstack.push(new Relation(myrel[i].first, myrel[i].second));
              myrel[i].first = ""; // erase
            }
            else if(myrel[i].second.indexOf(new_relator) >= 0) {
              myrel[i].second = this.reduce_word_from_left(myrel[i].second);
            }
          }
        }
      }
    }
		this.resolve_count++;
  }

  resolve_overlap(reli, relj, overlap_limit) {
    // if reli or relj is inactivated, the 'for' statement automatically breaks
    // since inactivated relator's .first == ""
    for(let k = 1; k < reli.first.length && k < relj.first.length; k++) {
			// ignore long overlap if the length limit is specified
			if(overlap_limit && reli.first.length + relj.first.length - k > overlap_limit) continue;
      if(reli.first.substr(reli.first.length - k) === relj.first.substr(0, k)) {
        this.relstack.push(new Relation(reli.first.substr(0, reli.first.length - k) + relj.second, reli.second + relj.first.substr(k)));
        this.resolve_relstack();
      }
    }
  }
  
  Knuth_Bendix(maxresolution = 10000, overlap_limit = 0)
    {
      this.reduce_relations();

			this.resolve_count = 0;

      let i = 0;
      while(i < this.relations.length) {
        let j = 0;
        let reli = this.relations[i];
        
        if(maxresolution && this.resolve_count > maxresolution) break;
				if(overlap_limit && overlap_limit < reli.first.length) {
					i++;
					continue;
				}
        while(j <= i && reli.first.length) {
          let relj = this.relations[j];
          if(maxresolution && this.resolve_count > maxresolution) break;
					if(overlap_limit && overlap_limit < relj.first.length) {
						j++;
						continue;
					}

          this.resolve_overlap(reli, relj, overlap_limit);
          if(j < i) this.resolve_overlap(relj, reli, overlap_limit);
          j++;
        }
        i++;
      }

      // remove inactive relations
      this.relations = this.relations.filter( function (rel) {
        return rel.first;
      });
    }

	// resolve duplicated relations
	reduce_relations() {
		this.relstack = this.relations.slice();
    this.relstack.reverse(); // so that popping order coincide with relation's order
    this.relations.splice(0); // clear all
		this.resolve_relstack();

		this.relator_changed = true;
	}

	// return "" if confluent, otherwise return word where the confluence fails
  confluence_naive() {
    for(const rela of this.relations) {
      let strP = rela.first;
      for(const relb of this.relations) {
        let strR = relb.first;
        for(let i = 1; i <= strP.length; i++) {
          let strB = strP.substr(strP.length - i, i);
          let k = 0;
          // k will be the length of largest common prefix of strB and strR
          for(; k < i; k++) {
            if(strB[k] !== strR[k]) break;
          }
          if(!k) continue; // not beginning of overlap
          
          // P = AUD, R = UE, B = UD
          let strD = strB.substr(k);
          let strE = strR.substr(k);
          
          if(!strD.length || !strE.length) {
            let strA = strP.substr(0, strP.length - i);
            let strU = strB.substr(0, k);
            let strQ = rela.second;
            let strS = relb.second;
						
            // test confluence of QE = PE = AUE = AR = AS or Q = P = AUD = ARD = ASD
            if(this.reduce_word(strA + strS + strD) !== this.reduce_word(strQ + strE)) {
              return strA + strS + strD + "=" + strA + strR + strD + strE + "=" + strQ + strE;
            }
          }
        }
      }
    }
    
    return ""; // *confluent*!
  }

	confluence(){
		this._check_update();
		if(this.is_reduced) return this.confluence_using_index();
		else return this.confluence_naive();
	}

	// optimized version but this is valid only when relations are reduced
	confluence_using_index() {
		for(const rel of this.relations) {
			let u = rel.first;
			// u := cs (c is generator)
			// let first state s
			let first_state = 0;
			for(let i = 1; i < u.length; i++) {
				first_state = this.index_table[first_state][this.gen2id[u[i]]];
			}

			let path = [first_state];
			let v = [0]; // word to append to u
			do {
				let gen_append = v[v.length - 1];
				let last_state = path[path.length - 1];
				let next_state = this.index_table[last_state][gen_append];
				let prefix_length = this.index2length[next_state];
				let second_relator = this.index2relator[next_state];

				if(prefix_length > v.length) {
					if(second_relator) { // overlap found!
						let overlap_len = prefix_length - v.length;
						let overlap_left = rel.second + second_relator.first.substr(overlap_len);
						let overlap_right = rel.first.substr(0, rel.first.length - overlap_len) + second_relator.second;
						
						if(this.reduce_word(overlap_left) !== this.reduce_word(overlap_right)) {
							let overlap = rel.first + second_relator.first.substr(overlap_len);
							return overlap_left + " = " + overlap + " = " + overlap_right;
						}
						v[v.length - 1]++;
					}
					else {
						path.push(next_state);
						v.push(0);
					}
				}
				else { // no proper overlap will be found in this way
					v[v.length - 1]++;
				}

				while(v[v.length - 1] >= this.gen_list.length) {
					v.pop();
					path.pop();
					v[v.length - 1]++;
				}
			} while(v.length);
		}

		return ""; // *confluent*
	}

  add_relation(left, right)
    {
      let rel = new Relation(left, right);
      
      if(rel.first != rel.second) {
        if(shortlex_order(rel.first, rel.second)) {
          let new_relator = rel.second;
          rel.second = rel.first;
          rel.first = new_relator;
        }

        if(!this.relations.some(r => r.first === rel.first && r.second === rel.second)) {
          this.relations.push(rel);
					this.relator_changed = true;
        }
      }
    }

  sort_relations(comparefunc = null) {
    if(comparefunc) {
      this.relations.sort(comparefunc);
    }
    else {// by default, using shortlex order (.first is prioritized)
      this.relations.sort(function(a, b) {
        if(a.first === b.first) {
          if(a.second === b.second) return 0;
          else {
            if(shortlex_order(a.second, b.second)) return -1;
            else return 1;
          }
        }
        else {
          if(shortlex_order(a.first, b.first)) return -1;
          else return 1;
        }
      });
    }
  }

	// for every relator l = r, l is irreducible w.r.t. other relators
	is_irreducible_system () {
		for(let i = 0; i < this.relations.length; i++) {
			for(let j = 0; j < this.relations.length; j++) {
				if(i != j) {
					if(this.relations[j].first.indexOf(this.relations[i].first) >= 0) return false;
				}
			}
		}
		return true;
	}

	remove_relations(index_list) {
		for(const i of index_list) {
			this.relations[i].first = "";
		}
		this.relations = this.relations.filter( function (rel) {
  	  return rel.first;
    });
		this.relator_changed = true;
	}

	remove_all_relations() {
		this.relations = [];
		this.relator_changed = true;
	}

	_left_generator_list() {
		let myindex = 0;
		for(const rel of this.relations) {
			for(const c of rel.first.split("")) {
				if(!(c in this.gen2id)) {
					this.gen2id[c] = myindex;
					this.gen_list.push(c);
					myindex++;
				}
			}
		}
	}

	_create_index_data(map, key, counter, rel) {
		if(map.has(key)) return counter;
		else {
			let tmp = new Array(this.gen_list.length + 2);
			tmp[this.gen_list.length] = rel;
			tmp[this.gen_list.length + 1] = counter;
			map.set(key, tmp);
			return counter + 1;
		}
	}

	generate_index_table() {
		// wipe previous data
		this.gen2id = {};
		this.gen_list = [];
		this.index_table = [];
		this.index2relator = [];
		this.index2length = [];

		// this index works only for reduced rewriting system
		if(!this.is_reduced) return;
		this._left_generator_list();

		// first set all prefixes of leftside
		let index_map = new Map;
		let key_counter = 0;

		key_counter = this._create_index_data(index_map, "", key_counter, 0);
		for(const rel of this.relations) {
			for(let i = 1; i < rel.first.length; i++) {
				key_counter = this._create_index_data(index_map, rel.first.substr(0, i), key_counter, 0);
			}
			key_counter = this._create_index_data(index_map, rel.first, key_counter, rel);
		}

		for(let entry of index_map) {
			let prefix = entry[0];
			let data = entry[1];
			if(data[this.gen_list.length]) { // prefix is leftside
				for(let i = 0; i < this.gen_list.length; i++) {
					data[i] = prefix;
				}
			}
			else { // if P := prefix, find longest suffix of Px in all prefixes
				for(let i = 0; i < this.gen_list.length; i++) {
					let str = prefix + this.gen_list[i];
					for(let j = 0; j <= str.length; j++) {
						if(index_map.has(str.substr(j))) {
							data[i] = str.substr(j);
							break;
						}
					}
				}
			}
		}

		this.index_table = new Array(index_map.size);
		this.index2relator = new Array(index_map.size);
		this.index2length = new Array(index_map.size);
		for(let entry of index_map) {
			let prefix = entry[0];
			let data = entry[1];
			let entry_id = data[this.gen_list.length + 1];
			this.index2relator[entry_id] = data[this.gen_list.length];
			this.index2length[entry_id] = prefix.length;
			let destination_list = new Array(this.gen_list.length);
			for(let i = 0; i < this.gen_list.length; i++) {
				destination_list[i] = index_map.get(data[i])[this.gen_list.length + 1];
			}
			this.index_table[entry_id] = destination_list;
		}
	}


	// traceable reduce_word
	reduce_word_t(w) {
    let result = w;
		let history = [];

		let relator_found = true;
		while(relator_found) {
			relator_found = false;
			for(const rel_id of this.relation_id_list) {
        if(rel_id) { // No. 0 means inactive
					let rel = this.relation_database[rel_id];
					let ind = result.indexOf(rel.first);
					if(ind >= 0) {
						relator_found = true;
						result = result.substr(0, ind) + rel.second + result.substr(ind + rel.first.length);
						history.push([ind, rel_id]);
						break;
					}
        }
			}
		}

    return [result, history];
  }

	resolve_relstack_t() {
    while(this.relstack_t.length) {
      let rel = this.relstack_t.pop();
			
      let left = this.reduce_word_t(rel.first);
      let right = this.reduce_word_t(rel.second);

      if(left[0] !== right[0]) { // new relation found!
				let new_rel;
        if(shortlex_order(left[0], right[0])) {
          new_rel = new Relation_t(right[0], left[0], rel.hist_descend.concat(right[1]), rel.hist_ascend.concat(left[1]));
        }
        else {
          new_rel = new Relation_t(left[0], right[0], rel.hist_ascend.concat(left[1]), rel.hist_descend.concat(right[1]));
        }

				let new_relator = new_rel.first;
        this.relation_database.push(new_rel);
				let new_rel_id = this.relation_database.length - 1;
				this.relation_id_list.push(new_rel_id);

        // update all relator *other* than the last 'rel' appended above
        for(let i = 0; i < this.relation_id_list.length - 1; i++) {
          if(this.relation_id_list[i]) { // if active
						let myrel = this.relation_database[this.relation_id_list[i]];
            if(myrel.first.indexOf(new_relator) >= 0) {
              this.relstack_t.push(myrel);
              this.relation_id_list[i] = 0; // obsolete
            }
            else if(myrel.second.indexOf(new_relator) >= 0) {
							let reduced = this.reduce_word_t(myrel.second);
							let reduced_rel = new Relation_t(myrel.first, reduced[0], myrel.hist_ascend, myrel.hist_descend.concat(reduced[1]));
							this.relation_database.push(reduced_rel);
							this.relation_id_list[i] = this.relation_database.length - 1;
            }
          }
        }
      }
    }
		this.resolve_count++;
  }

	// resolve duplicated relations
	reduce_relations_t() {
		// stack all relations in relation list
		for(const rel_id of this.relation_id_list) {
			this.relstack_t.push(this.relation_database[rel_id]);
		}
    this.relation_id_list.splice(0); // clear all
		this.resolve_relstack_t();
	}

  resolve_overlap_t(reli_id, relj_id, overlap_limit) {
		// in case relation_database is empty due to mistake
		if(!reli_id || !relj_id) return;

		let reli = this.relation_database[reli_id];
		let relj = this.relation_database[relj_id];

    for(let k = 1; k < reli.first.length && k < relj.first.length; k++) {
			// ignore long overlap if the length limit is specified
			if(overlap_limit && reli.first.length + relj.first.length - k > overlap_limit) continue;
      if(reli.first.substr(reli.first.length - k) === relj.first.substr(0, k)) {
        this.relstack_t.push(new Relation_t(reli.first.substr(0, reli.first.length - k) + relj.second, reli.second + relj.first.substr(k), [[reli.first.length - k, relj_id]], [[0, reli_id]]));
        this.resolve_relstack_t();
if(this.show_relation_list_history) console.log(this.list_formulas());
      }
    }
  }
  
  Knuth_Bendix_t(maxresolution = 10000, overlap_limit = 0)
    {
			// initialize
			this.relation_database = [new Relation_t("", "", [], [])];
			this.relation_id_list = [];
			this.relstack_t = [];

			// set initial relations
			let counter = 1;
			for(const rel of this.relations) {
				let rel_t = new Relation_t(rel.first, rel.second, [], []);
				this.relation_database.push(rel_t);
				rel_t = new Relation_t(rel.first, rel.second, [], [[0, counter]]);
				this.relstack_t.push(rel_t);
				counter++;
			}
			this.relstack_t.reverse();

      this.reduce_relations_t();
			this.resolve_count = 0;
if(this.show_relation_list_history) console.log(this.list_formulas());
      let i = 0;
      while(i < this.relation_id_list.length) {
        let j = 0;
        let reli = this.relation_id_list[i];
				if(!reli) {
					i++;
					continue;
				}
        
        if(maxresolution && this.resolve_count > maxresolution) break;
				if(overlap_limit && overlap_limit < this.relation_database[reli].first.length) {
					i++;
					continue;
				}
        while(j <= i && reli) {
					reli = this.relation_id_list[i];
          let relj = this.relation_id_list[j];
					if(!relj) {
						j++;
						continue;
					}

          if(maxresolution && this.resolve_count > maxresolution) break;
					if(overlap_limit && overlap_limit < this.relation_database[relj].first.length) {
						j++;
						continue;
					}

          this.resolve_overlap_t(reli, relj, overlap_limit);
          if(j < i) this.resolve_overlap_t(relj, reli, overlap_limit);
          j++;
        }
        i++;
      }

      // remove inactive relations
      this.relation_id_list = this.relation_id_list.filter( function (rel) {
        return rel;
      });
    }

	list_formulas() {
		let res = "";

		for(const rel_id of this.relation_id_list) {
			if(rel_id) {
				let rel = this.relation_database[rel_id];
				res += rel.first;
				if(rel.second) res += "=" + rel.second;
				res += " ";
			}
		}

		return res;
	}

	trace_relation(rel_id, shallow = true) {
		if(!rel_id || rel_id >= this.relation_database.length) return;
		
		let ascend = [];
		let descend = [[0, rel_id]];

		let cursor = 0;
		let is_ascending = false;
		let stack_direction = false;

		let stack = [];
		let word = this.relation_database[rel_id].first;
		let goal = this.relation_database[rel_id].second;
		let history = [];
		let abs_pos = 0;

		while(true) {
			let operation;
			if(is_ascending) operation = ascend[cursor];
			else operation = descend[cursor];

			let rel_begin = operation[0];
			let rel_id = operation[1];
			let rel = this.relation_database[rel_id];

			if(rel_id <= this.relations.length || (shallow && stack.length >= 1)) { // initial relation
				if(is_ascending) { // use the relation left to right
					history.push([word, abs_pos + rel_begin, rel.second, rel.first, this.name, rel_id]);
					word = word.substr(0, abs_pos + rel_begin) + rel.first + word.substr(abs_pos + rel_begin + rel.second.length);
				}
				else {
					history.push([word, abs_pos + rel_begin, rel.first, rel.second, this.name, rel_id]);
					word = word.substr(0, abs_pos + rel_begin) + rel.second + word.substr(abs_pos + rel_begin + rel.first.length);
				}
				
				if(is_ascending) {
					cursor--;
				}
				else {
					cursor++;
				}
			}
			else { // rel_id is not initial
				stack.push([rel_begin, ascend, descend, cursor, is_ascending]);
				stack_direction ^= is_ascending;
				if(!is_ascending) {
					ascend = rel.hist_ascend;
					descend = rel.hist_descend;
				}
				else { // use the relation right to left!
					descend = rel.hist_ascend;
					ascend = rel.hist_descend;
				}
				abs_pos += rel_begin;
				
				if(ascend.length) {
					is_ascending = true;
					cursor = ascend.length - 1;
				}
				else {
					is_ascending = false;
					cursor = 0;
				}
			}

			while(true) {
				if(is_ascending && cursor < 0) {
					is_ascending = false;
					cursor = 0;
				}
				
				if(!is_ascending && cursor >= descend.length) {
					if(stack.length) {
						let parent_state = stack.pop();
						abs_pos -= parent_state[0];
						ascend = parent_state[1];
						descend = parent_state[2];
						cursor = parent_state[3];
						is_ascending = parent_state[4];
						stack_direction ^= is_ascending;

						if(is_ascending) cursor--;
						else cursor++;
					}
					else break;
				}
				else break;
			}
			if(!stack.length) break;
		}
		
		history.push([goal, -1, "", "", ""]);
		return history;
	}

	count_weight_of_relation(basic_weight_list, usable_relations) {
		let weight_list = new Array(this.relation_database.length);
		
		for(let i = 0; i < this.relations.length; i++) {
			if(!basic_weight_list || basic_weight_list.length < this.relations.length) {
				weight_list[i + 1] = 1;
			}
			else {
				weight_list[i + 1] = basic_weight_list[i];
			}
		}

		for(let i = this.relations.length + 1; i < this.relation_database.length; i++) {
			let rel = this.relation_database[i];
			let counter = 0;
			
			for(const hist of rel.hist_ascend) {
				counter += weight_list[hist[1]];
			}
			for(const hist of rel.hist_descend) {
				counter += weight_list[hist[1]];
			}

			if(usable_relations && usable_relations.includes(i)) {
				counter = 1;
			}
			weight_list[i] = counter;
		}
		
		return weight_list;
	}

	// for current relation_id_list
	reduce_word_from_left_by_formulas(w) {
    let result = w;
		let database = this.relation_database

		while(
			this.relation_id_list.some(
				function(rel_id) {
					let relator_found = false;
					let rel = database[rel_id];
          if(rel.first.length) { // being .first empty means that it is not active
						let ind = result.indexOf(rel.first);
						if(ind >= 0) {
							relator_found = true;
							result = result.substr(0, ind) + rel.second + result.substr(ind + rel.first.length);
						}
          }
          
					return relator_found;
				}
			)
		);

    return result;
  }

	// return "" if confluent, otherwise return word where the confluence fails
  confluence_naive_formulas() {
    for(const rela_id of this.relation_id_list) {
			let rela = this.relation_database[rela_id];
      let strP = rela.first;
      for(const relb_id of this.relation_id_list) {
				let relb = this.relation_database[relb_id];
        let strR = relb.first;
        for(let i = 1; i <= strP.length; i++) {
          let strB = strP.substr(strP.length - i, i);
          let k = 0;
          // k will be the length of largest common prefix of strB and strR
          for(; k < i; k++) {
            if(strB[k] !== strR[k]) break;
          }
          if(!k) continue; // not beginning of overlap
          
          // P = AUD, R = UE, B = UD
          let strD = strB.substr(k);
          let strE = strR.substr(k);
          
          if(!strD.length || !strE.length) {
            let strA = strP.substr(0, strP.length - i);
            let strU = strB.substr(0, k);
            let strQ = rela.second;
            let strS = relb.second;
						
            // test confluence of QE = PE = AUE = AR = AS or Q = P = AUD = ARD = ASD
            if(this.reduce_word_from_left_by_formulas(strA + strS + strD) !== this.reduce_word_from_left_by_formulas(strQ + strE)) {
              return strA + strS + strD + "=" + strA + strR + strD + strE + "=" + strQ + strE;
            }
          }
        }
      }
    }
    
    return ""; // *confluent*!
  }
}

