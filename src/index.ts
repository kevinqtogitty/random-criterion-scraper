import 'module-alias/register';
import fs from 'fs';
import puppeteer from 'puppeteer';
import dayjs from 'dayjs';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface Film {
	title: string | null;
	director: string | null;
	country: string | null;
	year: number | null;
	link: string | null;
	img_url: string | null;
}

async function scrapeFilmData() {
	console.log('>>> scraping has begun');

	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.goto('https://films.criterionchannel.com/', {
		timeout: 0
	});
	await page.waitForSelector('.criterion-channel__tr');

	// Extract film information
	const filmInfo = await page.evaluate(() => {
		const filmRows = Array.from(document.querySelectorAll('.criterion-channel__tr'));

		return filmRows.map((film) => ({
			title: film
				.querySelector('.criterion-channel__td--title a')
				?.textContent?.replace(/(\r\n|\n|\r|\t)/gm, ''),
			director: film
				.querySelector('.criterion-channel__td--director')
				?.textContent?.replace(/(\r\n|\n|\r|\t)/gm, ''),
			country: film
				.querySelector('.criterion-channel__td--country span')
				?.textContent?.replace(/(\r\n|\n|\r|\t)/gm, ''),
			year: Number(
				film
					.querySelector('.criterion-channel__td--year')
					?.textContent?.replace(/(\r\n|\n|\r|\t)/gm, '')
			),
			link: film.querySelector('.criterion-channel__td--title a')?.getAttribute('href'),
			img_url: film.querySelector('.criterion-channel__film-img')?.getAttribute('src')
		}));
	});

	return filmInfo;
}

scrapeFilmData()
	.then((data) => {
		// 1. Create file
		fs.writeFileSync('./filmData.json', JSON.stringify(data, null, 2));
		console.log('>>> Done Scraping!');
	})
	.then(async () => {
		// 2. Upload to S3
		const s3Client = new S3Client({
			region: 'us-east-1'
		});
		const data = fs.readFileSync('./filmData.json');

		const params = {
			Bucket: 'random-criterion',
			Key: `${dayjs().format('YYYY-MM-DD')}.json`,
			Body: data,
			ContentType: 'application/json'
		};

		try {
			await s3Client.send(new PutObjectCommand(params));
			console.log('>>> Done uploading to S3!');
			s3Client.destroy();

			return data;
		} catch (error) {
			console.error('Error uploading to S3:', error);
			s3Client.destroy();

			return error;
		}
	})
	.then(async (file) => {
		// 3. Upsert data to DB
		const prisma = new PrismaClient();
		await prisma.$transaction(async (client) => {
			const data: Film[] = JSON.parse(file as string);
			await client.films.deleteMany({});

			await client.films.createMany({
				data: data.map((film: Film) => {
					return {
						title: film.title,
						director: film.director,
						country: film.country,
						year: film.year,
						link: film.link,
						img_url: film.img_url,
						created_at: dayjs().toISOString(),
						updated_at: dayjs().toISOString()
					};
				})
			});
		});

		console.log('>>> Done updating db!');
		await prisma.$disconnect();
	})
	.then(() => {
		// 4. Delete file
		fs.unlinkSync('./filmData.json');
		console.log('>>> Deleted file!');
	})
	.finally(async () => {
		// 5. Close browser
		const browser = await puppeteer.launch();
		await browser.close();
		console.log('>>> Closed browser!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('Error scraping film data:', error);
	});
