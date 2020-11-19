#include <iostream>
#include <iomanip>
#include <fstream>
#include <cstdint>
#include <string>
#include <vector>
#include <algorithm>
#include <ctime>

uint64_t xorshift(uint64_t x) {
  x = x ^ (x << 7);
  return x = x ^ (x >> 9);
}


uint32_t str2id(const std::string &str)
{
  uint32_t id = 0;
  
  for(int i = 0; i < str.size(); i++) {
    id <<= 2;
    switch(str[i]) {
    case 'a':
      break;
    case 'b':
      id += 1;
      break;
    case 'c':
      id += 2;
      break;
    case 'd':
      id += 3;
      break;
    default:
      return -1;
    }
  }

  return id;
}

std::string id2str(int length, uint32_t id) {
  const std::string letters = "abcd";
  std::string result = "";
  
  for(int i = length - 1; i >= 0; i--) {
    result.push_back(letters[(id >> 2*i) & 3]);
  }

  return result;
}

uint32_t encode_id(int length, uint32_t id)
{
  uint32_t len_code;
  
  if(length < 10) {
    len_code = (uint64_t)length << 28;
  }
  else if(length < 14) {
    len_code = (uint64_t)(length + 30) << 26;
  }
  else if(length == 14) {
    len_code = 11ULL << 28;
  }
  else { // length == 15
    len_code = 12ULL << 28;
  }

  return len_code + id;
}

void decode_id(uint32_t code, uint32_t &length, uint32_t &str_id)
{
  uint32_t top = code >> 26;
  
  if(top < 40) {
    length = top >> 2;
    str_id = code & 0x0fffffff;
  }
  else if(top < 44) {
    length = top - 30;
    str_id = code & 0x03ffffff;
  } else if(top < 48) {
    length = 14;
    str_id = code & 0x0fffffff;
  }
  else {
    length = 15;
    str_id = code & 0x3fffffff;
  }
}

class Relation {
public:
  std::string left, right;
  uint32_t left_id, right_id;

  Relation(const std::string &l, const std::string &r) {
    left = l; right = r;
    left_id = str2id(l); right_id = str2id(r);
  }
};

struct index_info {
  uint32_t left_id;
  uint32_t mask;
  uint16_t left_len;
  uint16_t manip_code;
  uint32_t right_id;
  uint32_t insert_id;
  uint16_t right_len;
  uint16_t insert_len;
  int delta_len;
};

bool operator<(const index_info& left, const index_info& right) {
  return left.delta_len < right.delta_len;
}

int main(int argc, char *argv[])
{
  const int max_len = 15;
  uint64_t max_search_len = 8;
  uint64_t max_dist = 0;
  std::string dumpfilename;
  
  uint16_t *strlist[max_len];

  if(argc < 2) {
    std::cerr << "specify relations" << std::endl;
    return 0;
  }

  std::vector<Relation> relation_list;
  
  for(int i = 1; i < argc; i++) {
    std::string str(argv[i]), l, r;
    auto eq_pos = str.find("=");
    if(eq_pos == std::string::npos) {
      l = str;
      r = "";
    }
    else {
      l = str.substr(0, eq_pos);
      r = str.substr(eq_pos + 1);

      // check option string
      if(l == "maxlen") {
        try {
          max_search_len = std::stoul(r);
        }
        catch(...) {
          std::cerr << "invalid maxlen!" << std::endl;
          return 1;
        }
        if(!max_search_len || max_search_len > max_len) {
          std::cerr << "invalid maxlen!" << std::endl;
          return 1;
        }
        
        continue;
      }
      else if(l == "maxdist") {
        try {
          max_dist = std::stoul(r);
        }
        catch(...) {
          std::cerr << "invalid maxdist!" << std::endl;
          return 1;
        }
        continue;
      }
      else if(l == "dumpname") {
        dumpfilename = r;
        continue;
      }
    }
    Relation rel(l, r);
    if(rel.left_id == -1 || rel.right_id == -1) {
      std::cerr << "contains invalid character: " << str << std::endl;
      return 1;
    }

    if(rel.left == rel.right || rel.left.size() > max_len || rel.right.size() > max_len) {
      std::cerr << "trivial or too long relation: " << str << std::endl;
      return 1;
    }

    relation_list.push_back(rel);
  }
  
  uint32_t rel_list_size = relation_list.size();
  if(rel_list_size > 2047) {
    std::cerr << "too many relations" << std::endl;
    return 0;
  }

  try{
    for(int i = 0; i < max_len; i++) {
      strlist[i] = new uint16_t[1ULL << (2*(i + 1))]();
    }
  }
  catch (std::bad_alloc) {
    std::cerr << "insufficient memory!" << std::endl;
    return 1;
  }

  if(dumpfilename.empty()) {
    dumpfilename = "dump.";
    for(uint32_t i = 0; i < rel_list_size; i++) {
      Relation &rel = relation_list[i];
      dumpfilename += rel.left;
      if(!rel.right.empty()) dumpfilename += "=" + rel.right;
      if(i < rel_list_size - 1) dumpfilename += "_";
      if(dumpfilename.size() > 100) {
        dumpfilename += "etc";
        break;
      }
    }
    dumpfilename += ".dat";
  }
  
  std::ofstream dumpfile;
  dumpfile.open(dumpfilename, std::ios::out | std::ios::binary | std::ios::trunc);
  if(!dumpfile) {
    std::cerr << "cannot open output file: " << dumpfilename << std::endl;
    return 1;
  }

  uint64_t distance = 1;
  uint64_t total_reached = 0;
  uint64_t total_reached_short = 0;
  uint64_t n_target_str = ((1ULL << (2*(max_search_len + 1))) - 1) / 3 - 1;
  
  std::vector<uint32_t> reached_words, newly_reached_words;
  
  for(uint32_t i = 0; i < rel_list_size; i++) {
    Relation &rel = relation_list[i];
    
    if(rel.left.empty()) {
      strlist[rel.right.size() - 1][rel.right_id] = 0x8000 + i + 1;
      reached_words.push_back(encode_id(rel.right.size(), rel.right_id));
      if(rel.right.size() <= max_search_len) total_reached_short++;
    }
    else if(rel.right.empty()) {
      strlist[rel.left.size() - 1][rel.left_id] = i + 1;
      reached_words.push_back(encode_id(rel.left.size(), rel.left_id));
      if(rel.left.size() <= max_search_len) total_reached_short++;
    }
  }
  total_reached += reached_words.size();

  // generate index data of relations
  std::vector<index_info> index_list, insert_list;
  for(uint32_t i = 0; i < rel_list_size; i++) {
    Relation &rel = relation_list[i];
    
    index_info l2r, r2l;
    l2r.left_id = rel.left_id;
    l2r.mask = (1ULL << (2*rel.left.size())) - 1;
    l2r.left_len = rel.left.size();
    l2r.manip_code = 0x8000 + i + 1; // inverse order!
    l2r.right_id = rel.right_id;
    l2r.right_len = rel.right.size();
    l2r.delta_len = rel.right.size() - rel.left.size();

    r2l.left_id = rel.right_id;
    r2l.mask = (1ULL << (2*rel.right.size())) - 1;
    r2l.left_len = rel.right.size();
    r2l.manip_code = i + 1;
    r2l.right_id = rel.left_id;
    r2l.right_len = rel.left.size();
    r2l.delta_len = rel.left.size() - rel.right.size();

    if(!l2r.left_len) {
      l2r.insert_id = l2r.right_id;
      l2r.insert_len = l2r.right_len;
      insert_list.push_back(l2r);
    }
    else index_list.push_back(l2r);

    if(!r2l.left_len) {
      r2l.insert_id = r2l.right_id;
      r2l.insert_len = r2l.right_len;
      insert_list.push_back(r2l);
    }
    else index_list.push_back(r2l);
  }
  std::sort(index_list.begin(), index_list.end());
  std::sort(insert_list.begin(), insert_list.end());

  uint64_t index_begin[max_len], index_end[max_len];
  uint64_t insert_begin[max_len], insert_end[max_len];
  // it's too difficult for me to determine appropriate interval exactly,
  // so I use stupid algorithm by compromize, sorry!(><;)
  for(int i = 0; i < max_len; i++) {
    index_begin[i] = index_list.size(); index_end[i] = 0;
    insert_begin[i] = insert_list.size(); insert_end[i] = 0;
    for(int j = 0; j < index_list.size(); j++) {
      if(-i - 1 <= index_list[j].delta_len && index_list[j].delta_len <= max_len - i - 1) {
        index_begin[i] = j;
        break;
      }
    }
    
    for(int j = index_list.size() - 1; j >= 0; j--) {
      if(-i - 1 <= index_list[j].delta_len && index_list[j].delta_len <= max_len - i - 1) {
        index_end[i] = j + 1;
        break;
      }
    }

    for(int j = 0; j < insert_list.size(); j++) {
      if(i + insert_list[j].insert_len < max_len) {
        insert_begin[i] = j;
        break;
      }
    }

    for(int j = insert_list.size() - 1; j >= 0; j--) {
      if(i + insert_list[j].insert_len < max_len) {
        insert_end[i] = j + 1;
        break;
      }
    }
  }
  
  std::time_t last_clock = std::time(nullptr);
  while(reached_words.size()) {
    if(max_dist && distance >= max_dist) break;
    
    uint32_t i, j;
    for(int l = 0; l < reached_words.size(); l++) {
      if(l % 10000 == 0 && last_clock != std::time(nullptr)) {
        std::cout << "\rstep" << distance << ": processing " << l << "/" << reached_words.size() << " (nextstep:" << newly_reached_words.size() << ", target:" << total_reached_short << "/" << n_target_str << ")" << std::flush;
        last_clock = std::time(nullptr);
      }
      
      decode_id(reached_words[l], i, j);
      for(uint64_t k = 0; k <= i; k++) {
        uint64_t prefix = j >> (2*k);
        uint64_t suffix = j & ((1ULL << (2*k)) - 1);

        // search using index
        if(k < i) {
          for(uint64_t r = index_begin[i - k - 1]; r < index_end[i - 1]; r++) {
            if((prefix & index_list[r].mask) == index_list[r].left_id && i >= k + index_list[r].left_len) {
              // found!
              uint64_t next_word = prefix >> (2*index_list[r].left_len);
              next_word = (next_word << (2*index_list[r].right_len)) + index_list[r].right_id;
              next_word = (next_word << (2*k)) + suffix;
              
              uint64_t next_word_len = i + index_list[r].delta_len;
              if(next_word_len && !strlist[next_word_len - 1][next_word]) {
                newly_reached_words.push_back(encode_id(next_word_len, next_word));
                if(next_word_len <= max_search_len) total_reached_short++;
                strlist[next_word_len - 1][next_word] = (k << 11) + index_list[r].manip_code;
              }
            }
          }
        }

        // insert
        for(uint64_t r = insert_begin[i - 1]; r < insert_end[i - 1]; r++) {
          uint64_t next_word = prefix;
          next_word = (next_word << (2*insert_list[r].insert_len)) + insert_list[r].insert_id;
          next_word = (next_word << (2*k)) + suffix;
          
          uint64_t next_word_len = i + insert_list[r].delta_len;
          if(!strlist[next_word_len - 1][next_word]) {
            newly_reached_words.push_back(encode_id(next_word_len, next_word));
            if(next_word_len <= max_search_len) total_reached_short++;
            strlist[next_word_len - 1][next_word] = (k << 11) + insert_list[r].manip_code;
          }
        }
      }
      if(total_reached_short >= n_target_str) break;
    }
    
    total_reached += newly_reached_words.size();
    std::cout << "\rstep" << distance << " finished(nextstep:" << newly_reached_words.size() << ", total:" << total_reached << "/" << (((1ULL<<(2*(max_len + 1))) - 1) / 3 - 1) << ", target:" << total_reached_short << "/" << n_target_str << ")" << std::endl;
    reached_words.swap(newly_reached_words);
    newly_reached_words.clear();
    distance++;
    if(total_reached_short >= n_target_str) break;
  }
  std::cout << "analysis finished" << std::endl;

  std::vector<uint16_t> shortest_path_data, lengthlist(n_target_str, -1);
  std::vector<uint32_t> offsetlist(n_target_str, -1);

  uint64_t item_count = 0;
  for(int i = 0; i < max_search_len; i++) {
    for(uint32_t j = 0; j < (1ULL << (2*(i + 1))); j++) {
      if(strlist[i][j]) {
        uint16_t length = 0;
        uint64_t word = j, word_len = i + 1;
        uint16_t nextinfo = strlist[i][j];
        offsetlist[item_count] = shortest_path_data.size();
        
        while(true) {
          shortest_path_data.push_back(nextinfo);
          length++;
          
          uint64_t pos = (nextinfo & 0x7800) >> 11;
          uint64_t rel_id = (nextinfo & 0x07ff) - 1;
          Relation &rel = relation_list[rel_id];

          uint64_t prefix = word >> (2*pos);
          uint64_t suffix = word & ((1ULL << (2*pos)) - 1);
          
          // rollback the manipulation
          if(nextinfo & 0x8000) { // right to left
            word_len = word_len + rel.left.size() - rel.right.size();
            word = prefix >> (2*rel.right.size());
            word = (word << (2*rel.left.size())) + rel.left_id;
            word = (word << (2*pos)) + suffix;
          }
          else { // left to right
            word_len = word_len + rel.right.size() - rel.left.size();
            word = prefix >> (2*rel.left.size());
            word = (word << (2*rel.right.size())) + rel.right_id;
            word = (word << (2*pos)) + suffix;
          }
          if(word_len) nextinfo = strlist[word_len - 1][word];
          else break;
        }
        lengthlist[item_count] = length;
      }
      item_count++;
    }
  }
  uint32_t path_data_size = shortest_path_data.size();
  std::cout << "data collection finished" << std::endl;

  std::vector<uint32_t> encoded_relations(2*rel_list_size);
  for(uint32_t i = 0; i < rel_list_size; i++) {
    encoded_relations[2*i] = encode_id(relation_list[i].left.size(), relation_list[i].left_id);
    encoded_relations[2*i + 1] = encode_id(relation_list[i].right.size(), relation_list[i].right_id);
  }
  uint32_t size_info = rel_list_size + (max_search_len << 16);
  dumpfile.write((char *)&size_info, sizeof(uint32_t));
  dumpfile.write((char *)encoded_relations.data(), sizeof(uint32_t) * encoded_relations.size());
  dumpfile.write((char *)lengthlist.data(), sizeof(uint16_t) * lengthlist.size());
  dumpfile.write((char *)offsetlist.data(), sizeof(uint32_t) * offsetlist.size());
  dumpfile.write((char *)&path_data_size, sizeof(uint32_t));
  dumpfile.write((char *)shortest_path_data.data(), sizeof(uint16_t) * shortest_path_data.size());
  
  dumpfile.close();
  
  std::cout << "dump finished" << std::endl;
  
  for(int i = 0; i < max_len; i++) {
    delete [] strlist[i];
  }
  
  return 0;
}
