When you feel like it is needed, like when you find errors or when there is something you need to remember to do, you can add that to this file.

This project is a better version of the Huawei Cloud calculator. It uses the Huawei Cloud calculator API to get the updated prices of the products and show them.

Use shadcn/ui when possible for the UI

When adding new services to this platform, always test if the prices are correct. Here is an API example to check the prices:
curl 'https://portal-intl.huaweicloud.com/api/cbc/global/rest/BSS/billing/ratingservice/v2/inquiry/resource?servieName=vpn' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'content-type: application/json; charset=UTF-8' \
  -b '_frid=f1ffc10f77c844b79cbb0cb28dddb9d2; locale=en-us; vk=ecc3a886-71e7-496a-9629-a97f1ce268a0; SessionID=058894e2-0ca0-4388-aff6-a28b900f13e0; ad_sc=; ad_mdm=; ad_cmp=; ad_ctt=; ad_tm=; ad_adp=; cf=Direct; uba_countrycode=BR; _fr_ssid=26cc68d81cf347c7aa2720098249ce2a; HWWAFSESID=14d58c72b5cf46635c; HWWAFSESTIME=1775051446556; _ga=GA1.2.1315453469.1775051459; _gid=GA1.2.1875972176.1775051459; _gat=1' \
  -H 'origin: https://www.huaweicloud.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.huaweicloud.com/intl/en-us/pricing/calculator.html' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36' \
  -H 'wise-groupid: 3.d3d3Lmh1YXdlaWNsb3VkLmNvbS9pbnRsL2VuLXVzL3ByaWNpbmcvY2FsY3VsYXRvci5odG1sIy92cG58Y2FsY3VsYXRvcl9ldnBuTmV0d29ya1R5cGVfc3dpdGNoXzB8UHJpdmF0ZSBuZXR3b3Jr..KPtX8U98.1775051483960' \
  --data-raw '{"regionId":"ap-southeast-1","chargingMode":1,"periodType":4,"periodNum":1,"subscriptionNum":1,"siteCode":"HWC","productInfos":[{"id":"1775051484234-0-OFFI810121225757646848","cloudServiceType":"hws.service.type.vpn","resourceType":"hws.resource.type.vpn.ipsecvpn","resourceSpecCode":"V300","productNum":1,"resourceSize":1,"resouceSizeMeasureId":14,"usageFactor":"duration","usageMeasureId":4,"usageValue":1}]}'

Always take the more declarative approach to adding new services to the website. Follow the example of DCS, for example.

ECS and Flexus L (for now) are the only ones that shouldn't follow this pattern
