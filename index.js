const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { execSync } = require('child_process');

async function run() {
    try {
        console.log("Fetching IUA website...");
        const { data } = await axios.get('https://iua.edu.sd/collages/itc');
        const $ = cheerio.load(data);
        
        // جلب أول خبر في الموقع، حتى لو لم يحتوي على كلمة "نتيجة"
        const firstNews = $('.flex.flex-col.gap-5.border-r-8.border-r-gold.pr-5').first();
        if (firstNews.length === 0) {
            console.log("لم يتم العثور على أي أخبار في الموقع.");
            return;
        }

        const currentTitle = firstNews.find('p.max-w-prose').text().trim();
        const currentDate = firstNews.find('span.text-gold').text().trim();
        const currentData = currentTitle + " | " + currentDate;
        
        console.log(`Current top news: ${currentData}`);

        let lastData = "";
        if (fs.existsSync('last_news.txt')) {
            lastData = fs.readFileSync('last_news.txt', 'utf8').trim();
        }

        // مقارنة أي تغيير في العنوان أو التاريخ
        if (currentData !== lastData) {
            console.log("تم رصد تغيير جديد!");
            
            // حفظ التغيير الجديد
            fs.writeFileSync('last_news.txt', currentData);

            // إعداد Git ليقوم برفع التحديث للمستودع
            execSync('git config --global user.name "github-actions[bot]"');
            execSync('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
            
            execSync('git add last_news.txt');
            execSync('git commit -m "تحديث حالة الموقع التلقائي" || echo "No changes to commit"');
            execSync('git push');

            // إذا لم يكن هذا التشغيل الأول، قم بإنشاء إشعار (Issue)
            if (lastData !== "") {
                const issueTitle = "🚨 رصد تحديث أو إضافة جديدة في موقع الكلية!";
                const issueBody = `تم رصد أي تحديث/إضافة جديدة في موقع الكلية الآن.\n\n**الخبر الجديد:** ${currentTitle}\n**التاريخ:** ${currentDate}\n\n[اضغط هنا لزيارة الموقع](https://iua.edu.sd/collages/itc)`;
                
                // إنشاء Issue سيقوم بإرسال إيميل لك فوراً من GitHub
                execSync(`gh issue create --title "${issueTitle}" --body "${issueBody}"`, {
                    stdio: 'inherit'
                });
                console.log("تم إنشاء الإشعار بنجاح!");
            }
        } else {
            console.log("لا يوجد أي تحديث جديد.");
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
