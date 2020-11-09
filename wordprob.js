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
	}

	_check_update() {
		if(this.relator_changed) {
			this.is_reduced = this.is_irreducible_system();
			if(this.is_reduced) {
				this.generate_index_table();
			}
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
//            result = result.replace(rel.first, function() {relator_found = true; return rel.second;});

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
		if(!this.index_table.length) return w;

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
  confluence() {
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

	left_generator_list() {
		this.gen2id = {};
		this.gen_list = [];
		
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
		this.left_generator_list();

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
		for(let entry of index_map) {
			let prefix = entry[0];
			let data = entry[1];
			let entry_id = data[this.gen_list.length + 1];
			this.index2relator[entry_id] = data[this.gen_list.length];
			let destination_list = new Array(this.gen_list.length);
			for(let i = 0; i < this.gen_list.length; i++) {
				destination_list[i] = index_map.get(data[i])[this.gen_list.length + 1];
			}
			this.index_table[entry_id] = destination_list;
		}
	}
}

