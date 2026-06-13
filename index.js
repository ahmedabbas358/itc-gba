const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { execSync } = require('child_process');

// تعريف المواقع التي سيتم مراقبتها
const TARGETS = [
    {
        name: "كلية الحاسوب (ITC)",
        url: "https://iua.edu.sd/collages/itc"
    },
    {
        name: "إدارة الامتحانات والشهادات",
        url: "https://iua.edu.sd/facilities/managment/exams"
    }
];

const BASE_URL = 'https://iua.edu.sd';
const STATE_FILE = 'last_news.json';

async function run() {
    try {
        let state = {};
        if (fs.existsSync(STATE_FILE)) {
            state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        }

        let hasChanges = false;
        let newIssues = [];

        for (const target of TARGETS) {
            console.log(`\nFetching ${target.name}...`);
            try {
                const { data } = await axios.get(target.url);
                const $ = cheerio.load(data);
                
                const firstNews = $('.flex.flex-col.gap-5.border-r-8.border-r-gold.pr-5').first();
                if (firstNews.length === 0) {
                    console.log(`لم يتم العثور على أي أخبار في ${target.name}.`);
                    continue;
                }

                let currentTitle = firstNews.find('img').attr('alt');
                if (!currentTitle) {
                    currentTitle = firstNews.find('p.max-w-prose').text().trim();
                } else {
                    currentTitle = currentTitle.trim();
                }

                const currentDate = firstNews.find('span.text-gold').text().trim();
                
                let newsLink = firstNews.find('a').attr('href');
                let fullNewsUrl = target.url;
                if (newsLink) {
                    fullNewsUrl = newsLink.startsWith('http') ? newsLink : BASE_URL + newsLink;
                }

                const currentData = currentTitle + " | " + currentDate;
                console.log(`[${target.name}] Current top news: ${currentData}`);

                const lastData = state[target.url] || "";

                if (currentData !== lastData) {
                    console.log(`[${target.name}] تم رصد تغيير جديد!`);
                    state[target.url] = currentData;
                    hasChanges = true;

                    if (lastData !== "") {
                        newIssues.push({
                            title: `🚨 رصد تحديث جديد في ${target.name}!`,
                            body: `مرحباً @ahmedabbas358 👋\nتم رصد تحديث أو إضافة جديدة في موقع **${target.name}** الآن.\n\n**الخبر الجديد:** ${currentTitle}\n**التاريخ:** ${currentDate}\n\n[اضغط هنا لزيارة الخبر مباشرة](${fullNewsUrl})`
                        });
                    }
                } else {
                    console.log(`[${target.name}] لا يوجد أي تحديث جديد.`);
                }
            } catch (err) {
                console.error(`خطأ أثناء جلب بيانات ${target.name}:`, err.message);
            }
        }

        if (hasChanges) {
            console.log("\nSaving new state...");
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

            // تحقق إذا كنا نعمل داخل GitHub Actions لكي لا تتوقف الأوامر عند الاختبار محلياً
            if (process.env.GITHUB_ACTIONS) {
                console.log("Pushing to GitHub...");
                execSync('git config --global user.name "github-actions[bot]"');
                execSync('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
                
                execSync(`git add ${STATE_FILE}`);
                
                if (fs.existsSync('last_news.txt')) {
                    try {
                        execSync('git rm last_news.txt');
                    } catch(e) {}
                }

                execSync('git commit -m "تحديث حالة المواقع التلقائي" || echo "No changes to commit"');
                execSync('git push');

                for (const issue of newIssues) {
                    execSync(`gh issue create --title "${issue.title}" --body "${issue.body}"`, {
                        stdio: 'inherit'
                    });
                    console.log(`تم إنشاء إشعار لـ ${issue.title} بنجاح!`);
                }
            } else {
                console.log("Local test completed. Skipped git push and issue creation to avoid hanging.");
            }
        } else {
            console.log("\nلم يتم رصد أي تغييرات في جميع المواقع.");
        }

    } catch (err) {
        console.error("\nحدث خطأ رئيسي أثناء التنفيذ:", err.message || err);
        process.exit(1);
    }
}

run();
