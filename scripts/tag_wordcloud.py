#!/usr/bin/env python3
"""Generate an interactive tag word cloud from a acgn_journey backup."""

from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from string import Template

WORDCLOUD_COLORS = [
    "#1d4ed8",
    "#0f766e",
    "#d97706",
    "#be123c",
    "#2563eb",
    "#0284c7",
    "#16a34a",
    "#ca8a04",
]

FONT_FAMILY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei UI", "Segoe UI", sans-serif'

PAGE_TEMPLATE = Template(
    """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>$page_title</title>
  <style>
    :root {
      color-scheme: light;
      --bg-top: #fff8f2;
      --bg-bottom: #f4f7fb;
      --ink: #241d33;
      --muted: #756b80;
      --line: rgba(36, 29, 51, 0.12);
      --card: rgba(255, 255, 255, 0.78);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: $font_family;
      color: var(--ink);
      background: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
    }

    main {
      width: min(1200px, calc(100% - 28px));
      margin: 0 auto;
      padding: 28px 0 26px;
    }

    .hero {
      text-align: center;
      margin-bottom: 16px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #8b5e34;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(30px, 3.2vw, 44px);
      line-height: 1.12;
      font-weight: 850;
      letter-spacing: 0;
    }

    .subtitle {
      width: min(760px, 100%);
      margin: 10px auto 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.75;
    }

    .stats {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 18px;
    }

    .stats span {
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.66);
      color: #43365c;
      font-size: 13px;
      font-weight: 700;
      backdrop-filter: blur(14px);
    }

    .cloud-card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--card);
      box-shadow: 0 24px 70px rgba(67, 54, 92, 0.14);
      backdrop-filter: blur(16px);
    }

    .chart-stage {
      padding: 14px;
    }

    .chart-stage .chart-container {
      width: 100% !important;
      height: clamp(560px, 72vh, 760px) !important;
    }

    .cloud-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-top: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.52);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    @media (max-width: 760px) {
      main {
        width: min(100% - 18px, 1200px);
        padding-top: 16px;
      }

      .hero {
        text-align: left;
      }

      .subtitle {
        margin-left: 0;
      }

      .stats {
        justify-content: flex-start;
      }

      .chart-stage {
        padding: 8px;
      }

      .chart-stage .chart-container {
        height: clamp(520px, 68vh, 700px) !important;
      }

      .cloud-footer {
        flex-direction: column;
      }
    }
  </style>
$dependency_html
</head>
<body>
  <main>
    <header class="hero">
      <p class="eyebrow">acgn_journey</p>
      <h1>标签词云</h1>
      <p class="subtitle">从导出的 JSON 备份生成，悬停查看次数，右上角工具可保存为图片，点击词条会更新底部提示。</p>
      <div class="stats" aria-label="词云摘要">
        <span>展示 $shown_count 个标签</span>
        <span>累计 $total_mentions 次出现</span>
        <span>最高频：$top_tag × $top_count</span>
      </div>
    </header>

    <section class="cloud-card" aria-label="交互式标签词云">
      <div class="chart-stage">
$chart_body
      </div>
      <footer class="cloud-footer">
        <span>生成时间：$generated_at</span>
        <span id="cloud-picked">点击词条可复制名称，并在这里显示选中项。</span>
      </footer>
    </section>
  </main>
</body>
</html>
"""
)

FALLBACK_TEMPLATE = Template(
    """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>$page_title</title>
  <style>
    :root {
      color-scheme: light;
      --bg-top: #fff8f2;
      --bg-bottom: #f4f7fb;
      --ink: #241d33;
      --muted: #756b80;
      --line: rgba(36, 29, 51, 0.12);
      --card: rgba(255, 255, 255, 0.78);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: $font_family;
      color: var(--ink);
      background: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
    }

    main {
      width: min(1200px, calc(100% - 28px));
      margin: 0 auto;
      padding: 28px 0 26px;
    }

    .hero {
      text-align: center;
      margin-bottom: 16px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #8b5e34;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(30px, 3.2vw, 44px);
      line-height: 1.12;
      font-weight: 850;
      letter-spacing: 0;
    }

    .subtitle {
      width: min(760px, 100%);
      margin: 10px auto 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.75;
    }

    .stats {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 18px;
    }

    .stats span {
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.66);
      color: #43365c;
      font-size: 13px;
      font-weight: 700;
      backdrop-filter: blur(14px);
    }

    .cloud-card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--card);
      box-shadow: 0 24px 70px rgba(67, 54, 92, 0.14);
      backdrop-filter: blur(16px);
    }

    .cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      padding: 20px;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 999px;
      color: var(--tag-color);
      background: var(--tag-bg);
      font-weight: 800;
      line-height: 1;
    }

    .tag b {
      min-width: 22px;
      padding: 2px 6px;
      border-radius: 999px;
      background: var(--tag-color);
      color: white;
      font-size: 0.68em;
      text-align: center;
    }

    .cloud-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-top: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.52);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    @media (max-width: 760px) {
      main {
        width: min(100% - 18px, 1200px);
        padding-top: 16px;
      }

      .hero {
        text-align: left;
      }

      .subtitle {
        margin-left: 0;
      }

      .stats {
        justify-content: flex-start;
      }

      .cloud {
        padding: 16px;
      }

      .cloud-footer {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="hero">
      <p class="eyebrow">acgn_journey</p>
      <h1>标签词云</h1>
      <p class="subtitle">未安装 pyecharts 时会回落到静态版。安装依赖后，页面会变成可交互词云。</p>
      <div class="stats" aria-label="词云摘要">
        <span>展示 $shown_count 个标签</span>
        <span>累计 $total_mentions 次出现</span>
        <span>最高频：$top_tag × $top_count</span>
      </div>
    </header>

    <section class="cloud-card" aria-label="静态标签词云">
      <div class="cloud">
$chips
      </div>
      <footer class="cloud-footer">
        <span>生成时间：$generated_at</span>
        <span>安装 pyecharts 后可获得悬停、工具栏和更柔和的交互布局。</span>
      </footer>
    </section>
  </main>
</body>
</html>
"""
)


def normalize_tags(value):
    if isinstance(value, list):
        raw = value
    elif isinstance(value, str):
        raw = re.split(r"[,，;；、\s|/]+", value)
    else:
        raw = []
    return [str(tag).strip() for tag in raw if str(tag).strip()]


def load_records(path: Path):
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    records = payload.get("records") if isinstance(payload, dict) else payload
    if not isinstance(records, list):
        raise SystemExit("备份 JSON 必须是数组，或者包含 records 数组。")
    return records


def count_tags(records, source: str) -> Counter:
    counter = Counter()
    for record in records:
        if not isinstance(record, dict):
            continue

        tags = []
        if source in {"all", "user"}:
            tags.extend(normalize_tags(record.get("tags")))
        if source in {"all", "anime"}:
            tags.extend(normalize_tags(record.get("animeTags")))
        counter.update(set(tags))
    return counter


def rank_tags(counter: Counter, limit: int):
    return sorted(counter.items(), key=lambda item: (-item[1], item[0]))[:limit]


def hex_to_rgb(hex_color: str):
    value = hex_color.lstrip("#")
    if len(value) != 6:
        return 0, 0, 0
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def rgba(hex_color: str, alpha: float) -> str:
    red, green, blue = hex_to_rgb(hex_color)
    return f"rgba({red}, {green}, {blue}, {alpha})"


def styled_pairs(counter: Counter, limit: int):
    ranked = rank_tags(counter, limit)
    return [
        {
            "name": tag,
            "value": count,
            "textStyle": {"color": WORDCLOUD_COLORS[index % len(WORDCLOUD_COLORS)]},
        }
        for index, (tag, count) in enumerate(ranked)
    ]


def extract_chart_fragments(rendered_html: str):
    head_match = re.search(r"<head[^>]*>(.*?)</head>", rendered_html, re.S | re.I)
    body_match = re.search(r"<body[^>]*>(.*?)</body>", rendered_html, re.S | re.I)
    if not head_match or not body_match:
        raise SystemExit("无法从 pyecharts 输出中提取 HTML 片段。")

    head_content = head_match.group(1)
    dependency_tags = re.findall(
        r"<script\b[^>]*>.*?</script>|<link\b[^>]*>",
        head_content,
        re.S | re.I,
    )
    dependency_html = "\n".join(tag.strip() for tag in dependency_tags)
    chart_body = body_match.group(1).strip()
    return dependency_html, chart_body


def render_with_pyecharts(counter: Counter, output: Path, limit: int) -> bool:
    try:
        from pyecharts import options as opts
        from pyecharts.charts import WordCloud
        from pyecharts.commons.utils import JsCode
    except ImportError:
        return False

    pairs = styled_pairs(counter, limit)
    chart = WordCloud(
        init_opts=opts.InitOpts(
            width="100%",
            height="720px",
            page_title="acgn_journey 标签词云",
            bg_color="rgba(255,255,255,0)",
        )
    )
    chart.add(
        "标签",
        [(item["name"], item["value"]) for item in pairs],
        shape="circle",
        word_gap=8,
        word_size_range=[18, 92],
        rotate_step=45,
        pos_left="center",
        pos_top="center",
        width="96%",
        height="92%",
        is_draw_out_of_bound=False,
        tooltip_opts=opts.TooltipOpts(
            formatter=JsCode(
                "function (params) { return '<strong>' + params.name + '</strong><br/>出现 ' + params.value + ' 次'; }"
            ),
            background_color="rgba(21, 16, 31, 0.95)",
            border_width=0,
            padding=[10, 12],
            textstyle_opts=opts.TextStyleOpts(
                color="#ffffff",
                font_family=FONT_FAMILY,
                font_size=13,
            ),
            extra_css_text="border-radius:12px;box-shadow:0 16px 36px rgba(21,16,31,.22);",
        ),
        textstyle_opts=opts.TextStyleOpts(
            font_family=FONT_FAMILY,
            font_weight="700",
            shadow_color="rgba(255,255,255,.55)",
            shadow_blur=3,
        ),
        emphasis_shadow_blur=18,
        emphasis_shadow_color="rgba(29, 78, 216, 0.22)",
    )

    series = chart.options.get("series", [])
    if series:
        for index, item in enumerate(series[0].get("data", [])):
            color = WORDCLOUD_COLORS[index % len(WORDCLOUD_COLORS)]
            item.setdefault("textStyle", {})
            item["textStyle"]["color"] = color

    chart.set_global_opts(
        title_opts=opts.TitleOpts(is_show=False),
        toolbox_opts=opts.ToolboxOpts(
            is_show=True,
            pos_right="18px",
            pos_top="12px",
            item_size=16,
            feature={
                "saveAsImage": {
                    "title": "保存图片",
                    "pixelRatio": 2,
                    "backgroundColor": "#fff8f2",
                },
                "restore": {"title": "重置"},
            },
        ),
        tooltip_opts=opts.TooltipOpts(is_show=True),
    )

    chart.add_js_events(
        f"""
        chart_{chart.chart_id}.on('click', function (params) {{
          if (!params || !params.name) return;
          var status = document.getElementById('cloud-picked');
          if (status) {{
            status.textContent = '已选中：' + params.name + '（' + params.value + ' 次）';
          }}
          if (window.console && console.log) {{
            console.log('Word cloud tag:', params.name, params.value);
          }}
        }});
        """
    )

    dependency_html, chart_body = extract_chart_fragments(chart.render_embed())
    top_tag, top_count = rank_tags(counter, limit)[0]
    rendered = PAGE_TEMPLATE.substitute(
        page_title="acgn_journey 标签词云",
        font_family=FONT_FAMILY,
        dependency_html=dependency_html,
        chart_body=chart_body,
        shown_count=min(len(counter), limit),
        total_mentions=sum(counter.values()),
        top_tag=html.escape(top_tag),
        top_count=top_count,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )
    output.write_text(rendered, encoding="utf-8")
    return True


def render_fallback(counter: Counter, output: Path, limit: int) -> None:
    ranked = rank_tags(counter, limit)
    top_tag, top_count = ranked[0]
    total_mentions = sum(counter.values())
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    chips = []
    max_count = max((count for _, count in ranked), default=1)
    for index, (tag, count) in enumerate(ranked):
        color = WORDCLOUD_COLORS[index % len(WORDCLOUD_COLORS)]
        alpha = 0.12 + (count / max_count) * 0.08
        chips.append(
            f'<span class="tag" title="{html.escape(tag)}: {count}" '
            f'style="font-size:{14 + int((count / max_count) * 42)}px;'
            f'--tag-color:{color};'
            f'--tag-bg:{rgba(color, alpha)};'
            f'--border-color:{rgba(color, 0.26)};">'
            f"{html.escape(tag)}<b>{count}</b></span>"
        )

    rendered = FALLBACK_TEMPLATE.substitute(
        page_title="acgn_journey 标签词云",
        font_family=FONT_FAMILY,
        shown_count=min(len(counter), limit),
        total_mentions=total_mentions,
        top_tag=html.escape(top_tag),
        top_count=top_count,
        generated_at=generated_at,
        chips="\n".join(chips),
    )
    output.write_text(rendered, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path, help="acgn_journey 导出的 JSON 备份。")
    parser.add_argument("-o", "--output", type=Path, default=Path("tag-wordcloud.html"))
    parser.add_argument("--source", choices=["all", "user", "anime"], default="all")
    parser.add_argument("--limit", type=int, default=80)
    args = parser.parse_args()

    records = load_records(args.backup)
    counter = count_tags(records, args.source)
    if not counter:
        raise SystemExit("没有在备份里找到标签数据。")

    rendered = render_with_pyecharts(counter, args.output, args.limit)
    if not rendered:
        render_fallback(counter, args.output, args.limit)

    print(f"Wrote {args.output} with {min(len(counter), args.limit)} tags.")


if __name__ == "__main__":
    main()
