import { $ } from "zx";

$.verbose = false;

async function assertResponse(response: Response) {
  if (!response.ok) {
    console.error("Request", response.url, "failed");
    console.error(await response.text());
    process.exit(1);
  }
}

async function getSessionid() {
  const nonAuthHeaders = {
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Connection: "keep-alive",
    DNT: "1",
    Host: "portal.simpleko.se",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Chromium";v="113", "Not-A.Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };

  const sessionIdResponse = await fetch(
    "https://portal.simpleko.se/api/portal/currentClient",
    { headers: nonAuthHeaders },
  );
  const sessionId = sessionIdResponse.headers
    .get("set-cookie")
    ?.split("=")[1]
    .split(";")[0];

  if (!sessionId) {
    console.error("unable to get a session id", await sessionIdResponse.text());
    process.exit(1);
  }
  console.log("got session id", sessionId);
  return sessionId;
}

const createHeaders = (sessionId: string) =>
  new Headers({
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Connection: "keep-alive",
    Cookie: `PHPSESSID=${sessionId}`,
    DNT: "1",
    Host: "portal.simpleko.se",
    Origin: "https://portal.simpleko.se",
    Referer: "https://portal.simpleko.se/kundportal/payouts",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Chromium";v="113", "Not-A.Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  });

const authenticate = async (headers: Headers) => {
  console.log("authenticating with username + password");
  headers.append("Content-Type", "application/json");
  const url = "https://portal.simpleko.se/api/auth/login";
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      password: process.env.PASSWORD,
      username: process.env.USERNAME,
    }),
  });
  await assertResponse(response);
};

async function authorizePayments(headers: Headers) {
  const payoutRes = await fetch(
    "https://portal.simpleko.se/api/portal/payouts",
    {
      headers,
    },
  ).then((it) => it.json());

  const payoutsToAuthorize = payoutRes.data.payouts.filter(
    (it) => it.authorized === "partial" || it.authorized === "false",
  );

  console.log("authorizing", payoutsToAuthorize.length, "payouts");

  await Promise.all(
    payoutsToAuthorize.map(async (it) => {
      const res = await fetch(
        `https://portal.simpleko.se/api/portal/payouts/${it.id}`,
        {
          headers,
        },
      ).then((it) => it.json());
      if (
        res.data.authorizers.some((it) => it.name === "Max Eric Netterberg")
      ) {
        console.log(
          "[",
          res.data.subject,
          "]",
          "is already authorized by you. skipping it",
        );
        return;
      }

      const allocationsVat = res.data.allocations.reduce((acc, curr) => {
        acc[Number(curr.id)] = curr.tax;
        return acc;
      }, {});

      const body = JSON.stringify({
        allocationsVat,
      });
      const contentLength = body.length;
      headers.append("Content-Length", contentLength.toString());
      headers.append("Content-Type", "application/json");

      const response = await fetch(
        `https://portal.simpleko.se/api/portal/payouts/${it.id}/authorize/true`,
        {
          headers,
          method: "PUT",
          body,
        },
      );
      await assertResponse(response);
    }),
  );

  console.log(payoutsToAuthorize.length, "payouts authorized");
}

async function authorizeSalaries(headers: Headers) {
  const salariesRes = await fetch(
    "https://portal.simpleko.se/api/portal/salaries",
    {
      headers,
    },
  ).then((it) => it.json());

  const salariesToAuthorize = salariesRes.data.salariesSummary
    .filter((it) => it.status === "partial")
    .map((it) => it.salaryId);

  console.log("authorizing", salariesToAuthorize.length, "salaries");

  await fetch("https://portal.simpleko.se/api/portal/salaries/authorize", {
    headers,
    body: JSON.stringify(salariesToAuthorize),
    method: "POST",
  });

  console.log(salariesToAuthorize.length, "salaries authorized");
}

const sessionId = await getSessionid();
const headers = createHeaders(sessionId);

await authenticate(headers);
await authorizePayments(headers);
await authorizeSalaries(headers);
