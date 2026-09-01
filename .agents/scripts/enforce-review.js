const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        const statusOutput = execSync('git -C .. status --porcelain').toString();
        const lines = statusOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        const hasCodeChanges = lines.some(line => line.endsWith('.ts'));
        
        let hasRecentReview = false;
        try {
            // Find the most recent modification time of any .ts file in src/
            let latestTsTime = 0;
            const findLatestTs = (dir) => {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    const fullPath = path.join(dir, f);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        findLatestTs(fullPath);
                    } else if (f.endsWith('.ts')) {
                        if (stat.mtimeMs > latestTsTime) {
                            latestTsTime = stat.mtimeMs;
                        }
                    }
                }
            };
            findLatestTs(path.join(__dirname, '..', '..', 'src'));

            const reviewsDir = path.join(__dirname, '..', '..', 'docs', 'reviews');
            const files = fs.readdirSync(reviewsDir);
            
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const stats = fs.statSync(path.join(reviewsDir, file));
                    // If a review file is newer than or very close to the latest TS change
                    if (stats.mtimeMs >= latestTsTime - 60000) {
                        hasRecentReview = true;
                        break;
                    }
                }
            }
        } catch(e) {
            // ディレクトリがない場合などは無視
        }

        if (hasCodeChanges && !hasRecentReview) {
            console.log(JSON.stringify({
                decision: "continue",
                reason: "🛑【ハードルール違反】ソースコード（.ts）が変更されていますが、その変更より新しいレビュー結果ファイルが docs/reviews/ ディレクトリに出力されていません。\nGEMINI.mdのルールに従い、サブエージェント（Independent Reviewer）を起動して独立検証を行わせてください。また、新仕様に対するテストが追加されていることも併せて確認してください。"
            }));
            return;
        }

        console.log(JSON.stringify({ decision: "stop" }));
    } catch (e) {
        console.log(JSON.stringify({ decision: "stop" }));
    }
});
