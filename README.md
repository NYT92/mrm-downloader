# MRM Downloader

Enchance tool & downloader for myreadingmanga.info.

## Features

- Download bulk images and videos from myreadingmanga.info including each pages
- Bulk downloading support resume (Bulk Download option only)
- Download manga/doujin into a ZIP file or PDF file
- Add bookmark button on top without scrolling down
- Hide the AI-generated post by default
- Supports Firefox and Chrome (Not polish)
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

> Chrome version is not polish, use at your own risk for now  

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

## Issue

You may need to refresh the page and try again for a few times to download the media. This is due to something that trigger the cloudflare detection. I am not sure how to fix this yet but it only happen for like a few times and eventually it will work. Be sure to check the ``Setting > Advance Option`` then find the ``Debug Tools`` and test the cookies to see if it return ``2xx``. If it return ``4xx`` then you need to update the cookies or resolve the cloudflare captcha.

### Bulk Download Issue

While downloading the next page, it will trigger the cloudflare detection and stop the download. There is a resume button but it will not work if the cloudflare detection is triggered and the file is already downloaded. You will need to restart the download and check the ``Debug Tools`` to see if the cookies are still returning ``2xx``.

If you encounter any issues, please leave a comment, create an issue, or contact me via Discord at ``@nyt92``. Please feel free to modify it as you see fit. Also, since everything is logged, open the console (Ctrl+Shift+I) or (F12), then go to the console tab and screenshot it for me.

## Adblocker (off topic)

If you use any adblocker, myreadingmanga will not work and it is not our script that causes the problem. The problem is that the adblocker blocks the main important URL that accesses those resources. 
To fix this for the uBlock origin user simply go to the `settings > my filter` and add those rules in and apply.

``@@||myreadingmanga.info/wp-admin/admin-ajax.php``  

![image](https://github.com/user-attachments/assets/70fc9cd1-0c7b-4674-a505-f8852a4d44b5)

## Contributing

If you want to contribute, please feel free to do so. This project is half-vibe coded and half-coded by me because it is for my internal tools but I would love to share my work...

## License

The code is licensed under the GNU GPLv3. Read more [here](https://gist.github.com/kn9ts/cbe95340d29fc1aaeaa5dd5c059d2e60#file-gplv3-md)

## Legal

I am not affiliated with myreadingmanga.info admin or moderator there and I created this tool only to download for personal archival or for viewing offline purposes. Please if you have money, go ahead and support all of these artists out there.
