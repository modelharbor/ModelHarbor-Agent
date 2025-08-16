import { Package } from "../../shared/package"

export const DEFAULT_HEADERS = {
	"HTTP-Referer": "https://github.com/modelharbor/ModelHarbor-Agent",
	"X-Title": "ModelHarbor Agent",
	"User-Agent": `ModelHarbor/${Package.version}`,
}

export const MODELHARBOR_HEADERS = {
	"HTTP-Referer": "https://github.com/modelharbor/ModelHarbor-Agent",
	"X-Title": "ModelHarbor Agent",
	"User-Agent": `ModelHarbor/${Package.version}`,
}
