#include <iostream>
#include <fstream>
#include <cstdint>
#include <string>
#include <vector>

typedef struct {
  uint64_t length;
  uint64_t id;
} str_data;

std::string id2str(int length, uint64_t id) {
  const std::string letters = "abcd";
  std::string result = "";
  
  for(int i = length - 1; i >= 0; i--) {
    result.push_back(letters[(id >> 2*i) & 3]);
  }

  return result;
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

std::string decode_id_str(uint32_t code)
{
  str_data dat;
  uint32_t top = code >> 26;
  int length;
  
  if(top < 40) {
    dat.length = top >> 2;
    dat.id = code & 0x0fffffff;
  }
  else if(top < 44) {
    dat.length = top - 30;
    dat.id = code & 0x03ffffff;
  } else if(top < 48) {
    dat.length = 14;
    dat.id = code & 0x0fffffff;
  }
  else {
    dat.length = 15;
    dat.id = code & 0x3fffffff;
  }

  const std::string letters = "abcd";
  std::string result;
  
  for(int i = dat.length - 1; i >= 0; i--) {
    result.push_back(letters[(dat.id >> 2*i) & 3]);
  }

  return result;
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

int main(int argc, char *argv[])
{
  if(argc < 2) {
    std::cerr << "usage: " << argv[0] << " dumpfile mode(stat, path) param" << std::endl;
    return 1;
  }
  std::string mode, param;
  if(argc >= 3) mode = std::string(argv[2]);
  if(argc >= 4) param = std::string(argv[3]);

  bool is_show_relation = true, is_show_stat = false, is_show_all_path = false;
  if(mode == "all") {
    is_show_stat = true;
    is_show_all_path = true;
  }
  else if(mode == "stat") {
    is_show_stat = true;
  }

  std::ifstream dumpfile(argv[1], std::ios::in | std::ios::binary);
  if(!dumpfile) {
    std::cerr << "cannot open the file!" << std::endl;
    return 1;
  }

  uint32_t rel_list_size, max_search_len, path_data_size;
  
  dumpfile.read((char *)&rel_list_size, sizeof(uint32_t));
  max_search_len = rel_list_size >> 16;
  rel_list_size &= 0xffff;
  if(!dumpfile || rel_list_size >= 2048 || !max_search_len || max_search_len > 15) {
    std::cerr << "invalid data!" << std::endl;
    return 1;
  }

  uint64_t n_target_str = ((1ULL << (2*(max_search_len + 1))) - 1) / 3 - 1;
  
  std::vector<uint32_t> encoded_relation_data(2*rel_list_size);
  dumpfile.read((char *)encoded_relation_data.data(), sizeof(uint32_t) * 2 * rel_list_size);
  if(!dumpfile) {
    std::cerr << "invalid data!" << std::endl;
    return 1;
  }

  std::vector<Relation> relation_list;

  if(is_show_relation) std::cout << "relation: ";
  for(uint32_t i = 0; i < rel_list_size; i++) {
    Relation rel(decode_id_str(encoded_relation_data[2*i]), decode_id_str(encoded_relation_data[2*i + 1]));
    relation_list.push_back(rel);

    if(is_show_relation) {
      if(rel.left.empty()) std::cout << ".=";
      else std::cout << rel.left << "=";
      
      if(rel.right.empty()) std::cout << ".";
      else std::cout << rel.right;
      
      if(i <  rel_list_size - 1) std::cout << ", ";
      else std::cout << std::endl;
    }
  }

  std::vector<uint16_t> lengthlist(n_target_str);
  std::vector<uint32_t> offsetlist(n_target_str);

  dumpfile.read((char *)lengthlist.data(), sizeof(uint16_t) * lengthlist.size());
  dumpfile.read((char *)offsetlist.data(), sizeof(uint32_t) * offsetlist.size());
  dumpfile.read((char *)&path_data_size, sizeof(uint32_t));
  if(!dumpfile) {
    std::cerr << "invalid data!" << std::endl;
    return 1;
  }

  std::cout << "contains about words whose length <= " << max_search_len << std::endl;
  std::cout << "total number of operation: " << path_data_size << std::endl;

  std::vector<uint16_t> shortest_path_data(path_data_size);
  dumpfile.read((char *)shortest_path_data.data(), sizeof(uint16_t) * path_data_size);
  if(!dumpfile) {
    std::cerr << "invalid data!" << std::endl;
    return 1;
  }
  
  uint64_t item_count = 0;
  uint64_t maxdist = 0;
  uint64_t n_reachable[max_search_len] = {}, n_total_reach = 0;
  for(int i = 0; i < max_search_len; i++) {
    for(uint64_t j = 0; j < (1ULL << (2*(i + 1))); j++) {
      if(lengthlist[item_count] != (uint16_t) (-1)) {
        n_reachable[i]++;
        n_total_reach++;
        if(maxdist < lengthlist[item_count]) maxdist = lengthlist[item_count];
        if(is_show_all_path) {
          std::cout << id2str(i + 1, j) + "," << lengthlist[item_count] << "; " << id2str(i + 1, j) << " = ";
          
          uint32_t offset = offsetlist[item_count];
          uint32_t seq_length = lengthlist[item_count];
          if(offset + seq_length <= path_data_size) {
            uint64_t word = j, word_len = i + 1;
            for(uint64_t s = 0; s < seq_length; s++) {
              uint16_t nextinfo = shortest_path_data[offset + s];
              uint64_t pos = (nextinfo & 0x7800) >> 11;
              uint64_t rel_id = (nextinfo & 0x07ff) - 1;
              
              if(rel_id >= relation_list.size()) {
                std::cerr << "data corrupted!" << std::endl;
                return 1;
              }
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
              if(word_len > 15) {
                std::cerr << "data corrupted!" << std::endl;
                return 1;
              }
              std::cout << id2str(word_len, word);
              if(s < seq_length - 1) std::cout << " = ";
              else std::cout << '.' << std::endl;
            }
            
          }
          else {
            std::cerr << "data corrupted!" << std::endl;
            return 1;
          }
        }
      }
      item_count++;
    }
  }
  
  std::cout << "distance of gen: ";
  for(int i = 0; i < 4; i++) {
    std::cout << "abcd"[i] << "(";
    if(lengthlist[i] != (uint16_t) (-1)) std::cout << lengthlist[i];
    else std::cout << "unknown";
    std::cout << ") ";
  }
  std::cout << std::endl;

  if(is_show_stat) {
    std::cout << "number of words whose path is known" << std::endl;
    for(uint64_t i = 0; i < max_search_len; i++) {
      std::cout << "len = " << i + 1 << ": " << n_reachable[i] << "/" << (1ULL << (2*(i + 1))) << std::endl;
    }
    std::cout << "total: " << n_total_reach << "/" << n_target_str << std::endl;
    std::cout << std::endl;

    std::cout << "distribution of distances" << std::endl;
    std::vector<uint64_t> n_dist_count(maxdist + 1, 0);
    uint64_t n_unknown = 0;
    for(uint64_t i = 0; i < n_target_str; i++) {
      if(lengthlist[i] != (uint16_t) (-1)) n_dist_count[lengthlist[i]]++;
      else n_unknown++;
    }

    for(uint64_t d = 1; d <= maxdist; d++) {
      std::cout << "d = " << d << ": " << n_dist_count[d] << std::endl;
    }
    std::cout << "unknown: " << n_unknown << std::endl;
  }

  dumpfile.close();
  
  return 0;
}
