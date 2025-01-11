# Myreadingmanga's downloader

Download bulk images/videos from MRM. Nobody asks for it but here we go...

## Feature

- Download bulk images from one page
- Download Video
- That's it lmao

## Usage

- Install Tampermonkey or any extension that supports userscript.

- Visit [Greasyfork](https://greasyfork.org/en/scripts/507784-mrm-downloader) and click on install or Install from the [GitHub](https://github.com/NYT92/mrm-downloader/raw/refs/heads/main/mrm.user.js) directly

- When installing the script, the script will tell you "A userscript wants to access a cross-origin resource". Since the script relies on GM_cookie & GM_xmlhttpRequest, Click __Allow all__ to use the script properly.

  <img src="https://i.imgur.com/IYqesP0.png" style="width:50%"/>

- After you are done, you can go to any manga page and click on the big yellow download button and it will be downloaded.

## Using the script

Due to these browser rules or limitations, you must provide the cookies because we needed the Cloudflare cookies to work. 
> __Notice: You must re-enter the cookies every time you see the Cloudflare DDOS page being loaded since it will always load it when the IP address has been switched or the cookies have already expired within 24 hours. We'll let you know if your cookies are expired and we can see that you actually downloaded the Cloudflare DDoS page instead of the images.__

+ Video Tutorial for beginner
  - [Tutorial for Firefox user](https://nspl.nyt92.eu.org/player?file=https://files.catbox.moe/jbn3w6.mp4&title=How%20to%20download%20images/video%20from%20myreadingmanga%20using%20mrm-downloader%20script%20(Firefox))  

  - [Tutorial for Chrome user](https://nspl.nyt92.eu.org/player?file=https://files.catbox.moe/zbgovw.mp4&title=How%20to%20download%20images/video%20from%20myreadingmanga%20using%20mrm-downloader%20script%20(Chrome))
  
+ To get the cookies (My method):
  - On the Myreadingmanga's website, open the console (Ctrl+Shift+I) or (F12) and then go to the Network tab and refresh the page
    
    ![image](https://github.com/user-attachments/assets/d645effb-052a-45b6-bd00-cd3cf29dc5ea)

  - Once again once you see "myreadingmanga.info" text, you can scroll through those headers and find the "Cookie" in the request headers
    
    ![image](https://github.com/user-attachments/assets/26976eb0-d9fd-4aff-93e6-b45f588720f1)  
    *ignore the incorrect text thing since I screenshot it in the wrong order but the method is still the same
  - After that go ahead and copy the whole value (don't include the word `Cookie:`)
  - Now click on the "Load 🍪" then paste the cookie you copied and save it
 
    ![image](https://github.com/user-attachments/assets/3d9e0e71-e7ce-4f8e-a920-0989a76d0f29)

You can use any method to get the cookies but be sure to copy everything or else the script will warn you or just break the content when you downloaded.

## Support
If there is any problem, leave a comment, create an issue, or contact me via my Discord, @nyt92. Please be nice and modify it whatever you want. Also, since everything is logged, open the console (Ctrl+Shift+I) or (F12), then go to the console tab and screenshot it for me.

## License

The code is licensed under the GNU GPLv3. Read more [here](https://gist.github.com/kn9ts/cbe95340d29fc1aaeaa5dd5c059d2e60#file-gplv3-md)

## Legal

This script has nothing to do with myreadingmanga.info and all of the mangas, doujin, and animation there. The script's purpose is to download those files for personal archival only, but if you have money, go ahead and support all of these artists.
