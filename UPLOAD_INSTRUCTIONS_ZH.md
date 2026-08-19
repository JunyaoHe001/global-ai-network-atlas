# GitHub 手动上传说明

目标仓库：`JunyaoHe001/global-ai-network-atlas`

## 推荐做法

1. 在 GitHub 仓库中切换到 `gh-pages` 分支。
2. 删除该分支中现有的全部文件和文件夹。
3. 解压本压缩包。
4. 将解压后目录中的**所有内容**上传到 `gh-pages` 分支根目录。
5. 确保仓库根目录直接出现 `index.html`，不能再多一层文件夹。
6. 在 Settings → Pages 中设置：
   - Source: Deploy from a branch
   - Branch: gh-pages
   - Folder: / (root)
7. 等待 Pages 构建完成。

## 上传后的正确路径

```text
/index.html
/.nojekyll
/assets/app.js
/assets/styles.css
/data/map.json
/data/meta.json
/data/years/2016.json
/data/years/2017.json
/data/years/2018.json
/data/years/2019.json
/data/years/2020.json
/data/years/2021.json
/data/years/2022.json
/data/years/2023.json
/data/years/2024.json
/data/years/2025.json
/docs/data-and-privacy.html
/docs/validation-results.json
/README.md
/DATA-NOTES.md
/SANITISATION.md
/UPLOAD_INSTRUCTIONS_ZH.md
```

## 最容易出错的地方

错误：

```text
/global-ai-network-atlas-MANUAL-UPLOAD-clean-v1/index.html
```

正确：

```text
/index.html
```

也就是说，压缩包外层文件夹本身不要上传，只上传其内部内容。
