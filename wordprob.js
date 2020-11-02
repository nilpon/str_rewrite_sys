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
	}
  
  reduce_word(w) {
    let result = w;

		while(
			this.relations.some(
				function(rel) {
					let relator_found = false;
          if(rel.first.length) { // being .first empty means that it is not active
            result = result.replace(rel.first, function() {relator_found = true; return rel.second;});
          }
          
					return relator_found;
				}
			)
		);

    return result;
  }
  
  resolve_relstack() {
    while(this.relstack.length) {
      let rel = this.relstack.pop();
			let new_relator;
    
      rel.first = this.reduce_word(rel.first);
      rel.second = this.reduce_word(rel.second);
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
              myrel[i].second = this.reduce_word(myrel[i].second);
            }
          }
        }
      }
    }
  }

  resolve_overlap(reli, relj) {
    // if reli or relj is inactivated, the 'for' statement automatically breaks
    // since inactivated relator's .first == ""
    for(let k = 1; k < reli.first.length && k < relj.first.length; k++) {
      if(reli.first.substr(reli.first.length - k) === relj.first.substr(0, k)) {
        this.relstack.push(new Relation(reli.first.substr(0, reli.first.length - k) + relj.second, reli.second + relj.first.substr(k)));
        this.resolve_relstack();
      }
    }
  }
  
  Knuth_Bendix(maxrelation = 100)
    {
      this.relstack = this.relations.slice();
      this.relstack.reverse(); // so that popping order coincide with relation's order
      this.relations.splice(0); // clear all
      
      this.resolve_relstack();

      let i = 0;
      while(i < this.relations.length) {
        let j = 0;
        let reli = this.relations[i];
        
        if(this.relations.length > maxrelation) break;
        while(j <= i && reli.first.length) {
          let relj = this.relations[j];
          if(this.relations.length > maxrelation) break;

          this.resolve_overlap(reli, relj);
          if(j < i) this.resolve_overlap(relj, reli);
          j++;
        }
        i++;
      }

      // remove inactive relations
      this.relations = this.relations.filter( function (rel) {
        return rel.first;
      });
      
      return this.relations.length <= maxrelation;
    }

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
              return false;
            }
          }
        }
      }
    }
    
    return true;
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
/*
  bool set_coxeter(const std::size_t rank, const std::vector<std::size_t> &degrees)
    {
      const std::string dic = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      
      if(rank > dic.size() - 1) return false;
      if(degrees.size() < rank * (rank - 1) / 2) return false;
      
      relations.clear();
      
      for(std::size_t i = 1; i <= rank; i++) {
        relations.push_back(std::make_pair(std::string({dic[i], dic[i]}), ""));
      }
      
      for(std::size_t i = 1; i < rank; i++) {
        for(std::size_t j = i + 1; j <= rank; j++) {
          std::size_t m = degrees[(i - 1) * (2 * rank - i) / 2 + j - i - 1];
          if(m > 1) {
            std::string leftstr, rightstr;
            for(std::size_t k = 1; k <= m; k++) {
              if(k % 2 == 1) {
                leftstr += dic[j];
                rightstr += dic[i];
              }
              else {
                leftstr += dic[i];
                rightstr += dic[j];
              }
            }
            relations.push_back(std::make_pair(leftstr, rightstr));
          }
        }
      }

      return true;
    }
*/
}

