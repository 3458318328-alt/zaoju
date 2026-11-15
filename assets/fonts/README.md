# 字体来源与授权

本站自托管两款字体，都是 SIL Open Font License 1.1，可免费商用。
`zaoju-kai-*.woff2` / `zaoju-serif-*.woff2` 是对原字体做的**子集化**（只保留页面用到的字），
由 `build/make-fonts.py` 生成。

## 霞鹜文楷（LXGW WenKai）

- 用途：正文、说明、按钮（`zaoju-kai-regular.woff2` 常规 / `zaoju-kai-medium.woff2` 中等）
- 来源：https://github.com/lxgw/LxgwWenKai
- 授权：SIL OFL 1.1，全文见 `OFL-LXGWWenKai.txt`
- 该授权附带额外许可：允许为网页字体交付而做子集化与格式转换（woff/woff2），
  但不得作为可安装的桌面字体再分发。本站只做网页子集，符合此条。

## 思源宋体（Noto Serif SC）

- 用途：标题（`zaoju-serif-600.woff2`，字重 600）
- 来源：https://fonts.google.com/noto/specimen/Noto+Serif+SC
- 授权：SIL OFL 1.1

## 改文案之后要重跑

子集只包含当前页面出现过的字。新增文字如果不在子集里，会回落到系统字体，观感会断层。
改完文案执行：

```
python build/make-fonts.py
```

脚本会重新扫描 `site/` 下的 html / js / css 并覆盖生成 woff2。
