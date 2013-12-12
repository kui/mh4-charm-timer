#!/usr/bin/env ruby
# -*- coding:utf-8-unix; mode:ruby; -*-

# Tenum888.csv からお守りの種類や、スキルに採番してファイルサイズ圧縮を図る
# 実行例: $ numbering < Tenum888.csv > foo.csv

LABEL_ROW_NUM = 1
DATA_OFFSET = 2

TABLE_COL_NUM = 0
SEED_COL_NUM = 2
CHARM_TYPE_COL_NUM = (4 .. 10)
CHARM_SKILL_COL_NUM = (11 .. 17)

TYPE_MAP_FILE_NAME = 'charm-types.csv'
SKILL_MAP_FILE_NAME = 'skills.csv'

##

require 'csv'

def main
  auto_number = lambda do |hash, key|
    hash[key] = hash.values.max.instance_eval{|i| i || 0 } + 1
  end

  type_map = Hash.new(&auto_number)
  skill_map = Hash.new(&auto_number)

  index = 0
  CSV.filter(STDIN.set_encoding('Shift_JIS', 'UTF-8'), row_sep: "\r\n") do |row|
    index += 1
    next if index <= DATA_OFFSET
    number row, type_map, skill_map
    row
  end

  CSV.open TYPE_MAP_FILE_NAME, 'w' do |io|
    type_map.to_a.each{|r| io << r }
  end
  CSV.open SKILL_MAP_FILE_NAME, 'w' do |io|
    skill_map.to_a.each{|r| io << r }
  end
end

def number row, tmap, smap
  CHARM_TYPE_COL_NUM.each do |i|
    row[i] = tmap[row[i]] if row[i]
  end
  CHARM_SKILL_COL_NUM.each do |i|
    row[i] = smap[row[i]] if row[i]
  end
end

main
