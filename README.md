# MRM Downloader

Download bulk images and videos from myreadingmanga.info.

## Features

- Download bulk images and videos from myreadingmanga.info.
- Download manga/doujin into a ZIP file or PDF file
- Support downloading videos, GIFs, images in one place into a ZIP format
- Hide the AI-generated post by default
- Supports Firefox and Chrome
- Supports auto/custom cloudflare cookies to bypass the cloudflare captcha
- that it...

## Installation

### Userscript

All the docs moved to the [userscript](https://github.com/NYT92/mrm-downloader/tree/main/userscript) folder.

### Firefox

1. Download the extension from the [releases](https://github.com/NYT92/mrm-downloader/releases) page.
2. Click the ``mrm-downloader-x.x.x.xpi`` file
3. Allow all of these it when prompted.  
   <img width="410" height="206" alt="zen_Ng4SZM8P8F" src="https://github.com/user-attachments/assets/efb097fa-2b82-43b2-be9f-9d80965b18ed" />  
   <img width="411" height="423" alt="zen_pkTTCDUWLv" src="https://github.com/user-attachments/assets/1d2d279a-7524-46eb-a91a-890691bcb95d" />

5. You can now use the extension by going to any manga/doujin/videos page on myreadingmanga.info.

### Chrome

> This may apply to other Chromium-based browsers like Brave, Edge, etc but I have not tested it on other browsers just yet.

1. Download or clone this repository to your computer.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click the **"Load unpacked"** button.
5. In the file dialog, select the `chrome` folder from this repository (the folder containing `manifest.json`).
6. The extension should now appear in your extensions list and be ready to use.

> You may need to pin the extension to your toolbar for easy access.

**Note:**  
If you update the extension files, you can click the "Reload" button on the extension card in `chrome://extensions/` to apply changes.

## Contributing

If you want to contribute, please feel free to do so. This project is half-vibe coded and half-coded by me because it is for my internal tools but I would love to share my work...

> SOON

## Adblocker (off topic)

If you use any adblocker, myreadingmanga will not work and it is not our script that causes the problem. The problem is that the adblocker blocks the main important URL that accesses those resources. 
To fix this for the uBlock origin user simply go to the `settings > my filter` and add those rules in and apply.

``@@||myreadingmanga.info/wp-admin/admin-ajax.php``  

![image](https://github.com/user-attachments/assets/70fc9cd1-0c7b-4674-a505-f8852a4d44b5)


## Support

If you encounter any issues, please leave a comment, create an issue, or contact me via Discord at ``@nyt92``. Please feel free to modify it as you see fit. Also, since everything is logged, open the console (Ctrl+Shift+I) or (F12), then go to the console tab and screenshot it for me.

## License

The code is licensed under the GNU GPLv3. Read more [here](https://gist.github.com/kn9ts/cbe95340d29fc1aaeaa5dd5c059d2e60#file-gplv3-md)

## Legal

I am not affiliated with myreadingmanga.info admin or moderator there and I create and use the script to download those files for personal archival or for viewing offline purposes. **If you have money, go ahead and support all of these artists there so that they can produce good shit for all**.
