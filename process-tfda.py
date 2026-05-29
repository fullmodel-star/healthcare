"""聚合 TFDA 食品營養成分資料庫 JSON → FOOD_DB JS 格式。

原資料每食品一筆營養素一行（123 MB）。本腳本：
1. 串流讀取 JSON
2. 以「整合編號」聚合
3. 抽出 熱量 / 蛋白質 / 脂肪 / 碳水 / 膳食纖維 5 項
4. 輸出簡化 JS 陣列（FOOD_DB 格式）
"""
import json
import re
import sys

INPUT = '20_5.json'
OUTPUT = 'food-db-full.js'

# 嚴格相等比對（避免「脂肪酸」誤匹配「脂肪」）
NUTRIENT_EXACT = {
    '熱量':       'cal100',
    '粗蛋白':     'pro100',
    '蛋白質':     'pro100',
    '粗脂肪':     'fat100',
    '總脂肪':     'fat100',
    '總碳水化合物': 'carb100',
    '碳水化合物': 'carb100',
    '膳食纖維':   'fiber100',
}

# 食品分類 → 應用內歸類（合併些較少用的）
CAT_MAP = {
    '穀物類': '穀物澱粉',
    '澱粉類': '穀物澱粉',
    '堅果及種子類': '油脂堅果',
    '油脂類': '油脂堅果',
    '水果類': '水果類',
    '蔬菜類': '蔬菜類',
    '藻類': '蔬菜類',
    '菇類': '蔬菜類',
    '豆類': '豆製品',
    '肉類': '肉類',
    '蛋類': '蛋類',
    '魚貝類': '魚貝類',
    '乳品類': '乳品類',
    '加工調理食品類': '加工食品',
    '糖類': '甜點',
    '飲料類': '飲料',
    '糕餅點心類': '甜點',
    '調味料類': '調味料',
    '其他類': '其他',
}

def to_num(v):
    """字串轉浮點，去除空白與單位提示。失敗回 0。"""
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    # 移除可能的非數字尾綴
    m = re.match(r'^-?\d+\.?\d*', s)
    if not m:
        return None
    try:
        return float(m.group())
    except ValueError:
        return None


def main():
    print(f'讀取 {INPUT} ...', flush=True)
    with open(INPUT, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f'  共 {len(data):,} 行紀錄', flush=True)

    # 聚合
    foods = {}  # 整合編號 → {name, cat, nutrients...}
    for row in data:
        fid = row.get('整合編號')
        if not fid:
            continue
        if fid not in foods:
            foods[fid] = {
                'id_raw': fid,
                'name': (row.get('樣品名稱') or '').strip(),
                'cat_raw': (row.get('食品分類') or '').strip(),
                'desc': (row.get('內容物描述') or '').strip(),
            }
        item = foods[fid]
        # 每單位重（官方一份克數），取第一個非零值
        if 'unitG' not in item:
            uw = to_num(row.get('每單位重'))
            if uw and uw > 0:
                item['unitG'] = uw
        analysis = (row.get('分析項') or '').strip()
        key = NUTRIENT_EXACT.get(analysis)
        if not key:
            continue
        val = to_num(row.get('每100克含量'))
        if val is None:
            continue
        # 若同一營養素有多筆來源（粗蛋白 / 蛋白質皆有），保留先出現的
        if item.get(key) is None:
            item[key] = val

    print(f'  聚合後 {len(foods):,} 個唯一食品', flush=True)

    # 過濾與整理
    out = []
    next_id = 1
    skipped = {'no_cal': 0, 'no_name': 0, 'all_zero': 0}
    for fid, item in foods.items():
        name = item.get('name', '').strip()
        if not name:
            skipped['no_name'] += 1
            continue
        cal = item.get('cal100')
        if cal is None or cal <= 0:
            skipped['no_cal'] += 1
            continue
        pro = item.get('pro100', 0) or 0
        fat = item.get('fat100', 0) or 0
        carb = item.get('carb100', 0) or 0
        fiber = item.get('fiber100', 0) or 0
        # 全零過濾
        if cal == 0 and pro == 0 and fat == 0 and carb == 0:
            skipped['all_zero'] += 1
            continue
        cat_raw = item.get('cat_raw', '')
        cat = CAT_MAP.get(cat_raw, cat_raw or '其他')
        # 判斷單位：飲料/液體類用 ml，其他用 g（簡化規則）
        unit = 'ml' if cat in ('飲料', '乳品類') else 'g'
        entry = {
            'id': next_id,
            'name': name,
            'cat': cat,
            'cal100': round(cal, 1),
            'pro100': round(pro, 1),
            'fat100': round(fat, 1),
            'carb100': round(carb, 1),
            'fiber100': round(fiber, 1),
            'unit': unit,
            'src': 'fda',
        }
        uw = item.get('unitG')
        if uw and uw > 0:
            entry['unitG'] = round(uw)  # 官方每份克數
        out.append(entry)
        next_id += 1

    print(f'  跳過：無熱量 {skipped["no_cal"]}，無名稱 {skipped["no_name"]}，全零 {skipped["all_zero"]}', flush=True)
    print(f'  最終輸出 {len(out):,} 筆', flush=True)

    # 按類別 + 名稱排序，較好瀏覽
    out.sort(key=lambda x: (x['cat'], x['name']))
    # 重新編 id（排序後）
    for i, item in enumerate(out, 1):
        item['id'] = i

    # 輸出緊湊 JSON
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        f.write('// 衛福部食藥署 台灣食品營養成分資料庫 (TFDA Open Data #20)\n')
        f.write(f'// 來源：data.gov.tw/dataset/8543 · 共 {len(out):,} 筆\n')
        f.write('const FOOD_DB=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    import os
    size = os.path.getsize(OUTPUT)
    print(f'  寫入 {OUTPUT}（{size/1024:.1f} KB）', flush=True)

    # 印出各類別計數作為總覽
    from collections import Counter
    cats = Counter(x['cat'] for x in out)
    print('\n各類別數量：')
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f'  {c}: {n}')


if __name__ == '__main__':
    main()
